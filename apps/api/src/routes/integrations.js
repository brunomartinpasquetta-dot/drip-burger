import express from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { encrypt, decrypt, mask } from '../utils/crypto.js';
import {
    initWhatsApp,
    destroyWhatsApp,
    sendMessage,
    getStatus as getWhatsAppStatus,
    getQrCode as getWhatsAppQr,
    isReady as waIsReady,
    getClient as getWhatsAppClient,
    normalizePhone as normalizeWhatsAppPhone,
} from '../services/whatsappService.js';

const router = express.Router();

// Todas las rutas de /integrations requieren JWT admin
router.use(requireAdmin);

// ── Helpers para leer/escribir registros de integrations ─────────
// Auto-upsert: si la migración 1776500000 no se ejecutó (PB nunca reinició
// tras agregar el archivo, o se está corriendo en un entorno fresco), el
// getFirstListItem tira 404 y los endpoints /status devolvían 500 →
// frontend mostraba "No se pudo cargar" sin posibilidad de recuperación.
// Ahora si no existe lo creamos con defaults seguros (disconnected/disabled).
const DEFAULT_INTEGRATIONS = {
    whatsapp: {
        enabled: false,
        status: 'disconnected',
        config: { sessionExists: false, phoneNumber: '' },
    },
    mercadopago: {
        enabled: false,
        status: 'disconnected',
        config: { accessToken: '', publicKey: '', webhookSecret: '' },
    },
};

const getIntegration = async (key) => {
    try {
        return await pb.collection('integrations').getFirstListItem(`key="${key}"`, { requestKey: null });
    } catch (err) {
        if (err?.status === 404 && DEFAULT_INTEGRATIONS[key]) {
            logger.warn(`[integrations] record "${key}" missing in PB — creando con defaults`);
            try {
                return await pb.collection('integrations').create({
                    key,
                    ...DEFAULT_INTEGRATIONS[key],
                }, { requestKey: null });
            } catch (createErr) {
                logger.error(`[integrations] no pude auto-seedear "${key}": ${createErr?.message || createErr}`);
                throw createErr;
            }
        }
        throw err;
    }
};

const patchIntegration = async (key, patch) => {
    const rec = await getIntegration(key);
    return pb.collection('integrations').update(rec.id, {
        ...patch,
        lastCheckedAt: new Date().toISOString(),
    }, { requestKey: null });
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  WHATSAPP                                                     ║
// ╚══════════════════════════════════════════════════════════════╝

// GET /integrations/whatsapp/status
router.get('/whatsapp/status', async (req, res) => {
    try {
        const rec = await getIntegration('whatsapp');
        const live = getWhatsAppStatus();

        return res.json({
            enabled: !!rec.enabled,
            status: live.status || rec.status || 'disconnected',
            phoneNumber: live.phoneNumber || rec.config?.phoneNumber || null,
            qrCode: live.status === 'pending_qr' ? getWhatsAppQr() : null,
            lastError: live.lastError || rec.lastError || null,
            lastCheckedAt: rec.lastCheckedAt || null,
        });
    } catch (err) {
        logger.error(`[integrations/whatsapp/status] ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

// POST /integrations/whatsapp/connect
// Dispara initWhatsApp({ force: true }) + marca enabled=true en PB.
// Si la integración estaba en disconnected/error (típicamente desvinculación
// remota), pasa wipeSession=true para garantizar QR fresco. Si estaba en
// connected/pending_qr, no wipea (preserva la sesión válida).
router.post('/whatsapp/connect', async (req, res) => {
    try {
        // Leer estado actual ANTES de patchear PB, para decidir si wipear.
        let prevStatus = null;
        try {
            const rec = await getIntegration('whatsapp');
            prevStatus = rec?.status || null;
        } catch (e) { /* noop */ }
        const liveBefore = getWhatsAppStatus();
        const shouldWipe = (prevStatus === 'disconnected' || prevStatus === 'error') ||
            (liveBefore.status === 'disconnected' || liveBefore.status === 'error');

        await patchIntegration('whatsapp', { enabled: true, status: 'pending_qr', lastError: '' });
        await initWhatsApp({ force: true, wipeSession: shouldWipe });

        // Dar unos segundos para que el client emita QR o ready.
        // No bloqueamos más de 12s — el frontend hará polling /status.
        // Con wipeSession el initialize() tarda un poco más (re-pairing).
        const start = Date.now();
        while (Date.now() - start < 12000) {
            if (waIsReady()) break;
            if (getWhatsAppQr()) break;
            await new Promise(r => setTimeout(r, 300));
        }

        const live = getWhatsAppStatus();
        return res.json({
            enabled: true,
            status: live.status,
            phoneNumber: live.phoneNumber,
            qrCode: live.status === 'pending_qr' ? getWhatsAppQr() : null,
            wipedSession: shouldWipe,
        });
    } catch (err) {
        logger.error(`[integrations/whatsapp/connect] ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

// POST /integrations/whatsapp/disconnect
router.post('/whatsapp/disconnect', async (req, res) => {
    try {
        await destroyWhatsApp({ wipeSession: true });
        await patchIntegration('whatsapp', {
            enabled: false,
            status: 'disconnected',
            config: { sessionExists: false, phoneNumber: '' },
            lastError: '',
        });
        return res.json({ success: true });
    } catch (err) {
        logger.error(`[integrations/whatsapp/disconnect] ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

// POST /integrations/whatsapp/test  { phone }
router.post('/whatsapp/test', async (req, res) => {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    if (!waIsReady()) {
        return res.status(400).json({ error: 'WhatsApp no está conectado. Conectá primero.' });
    }

    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized || normalized.length < 12) {
        return res.status(400).json({
            error: `Teléfono inválido. Esperaba formato AR (ej +54 9 342 512 3456). Normalizado: "${normalized}"`,
            phoneNormalized: normalized,
        });
    }

    // Pre-check: si el número objetivo es el mismo que el conectado, WA Web
    // rechaza el envío a uno mismo con "wid error: invalid wid". Devolvemos
    // mensaje claro en vez del error críptico de puppeteer.
    try {
        const live = getWhatsAppStatus();
        const ownNumber = (live.phoneNumber || '').replace(/[^0-9]/g, '');
        if (ownNumber && ownNumber === normalized) {
            return res.status(400).json({
                error: 'No podés mandarte un mensaje a vos mismo. Probá con otro número (ej: tu celu personal).',
                phoneNormalized: normalized,
                ownNumber,
            });
        }
    } catch (e) { /* noop — chequeo best-effort */ }

    // Pre-check: el número debe estar registrado en WhatsApp.
    // isRegisteredUser tira si puppeteer está en mal estado, así que lo
    // envolvemos y caemos al sendMessage si no podemos verificar.
    const chatId = `${normalized}@c.us`;
    try {
        const client = getWhatsAppClient();
        if (client && typeof client.isRegisteredUser === 'function') {
            const exists = await client.isRegisteredUser(chatId);
            if (!exists) {
                return res.status(400).json({
                    error: `El número ${normalized} no tiene WhatsApp. Verificá que sea correcto.`,
                    phoneNormalized: normalized,
                });
            }
        }
    } catch (e) {
        logger.warn(`[whatsapp/test] isRegisteredUser falló (sigo igual con sendMessage): ${e?.message || e}`);
    }

    try {
        const msg = `🍔 Test de conexión Drip Burger ✅\n\nSi estás leyendo esto, la integración con WhatsApp funciona perfecto.`;
        await sendMessage(phone, msg);
        return res.json({ success: true, phoneNormalized: normalized });
    } catch (err) {
        logger.error(`[integrations/whatsapp/test] phone="${phone}" normalized="${normalized}" err=${err?.message || err}`);
        return res.status(500).json({
            success: false,
            error: err?.message || String(err),
            phoneNormalized: normalized,
        });
    }
});

// POST /integrations/whatsapp/toggle  { enabled }
// Endpoint auxiliar para el toggle rápido de la UI sin tocar rules/PB directamente.
router.post('/whatsapp/toggle', async (req, res) => {
    const { enabled } = req.body || {};
    try {
        await patchIntegration('whatsapp', { enabled: !!enabled });
        if (!enabled) {
            await destroyWhatsApp({ wipeSession: false });
        }
        return res.json({ success: true, enabled: !!enabled });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ╔══════════════════════════════════════════════════════════════╗
// ║  MERCADO PAGO                                                 ║
// ╚══════════════════════════════════════════════════════════════╝

// GET /integrations/mercadopago/status
// Devuelve solo info enmascarada — nunca el accessToken completo.
router.get('/mercadopago/status', async (req, res) => {
    try {
        const rec = await getIntegration('mercadopago');
        const config = rec.config || {};

        let publicKey = '';
        let accessTokenPreview = '';
        try {
            publicKey = config.publicKey ? decrypt(config.publicKey) : '';
        } catch (e) {
            publicKey = '';
        }
        try {
            const at = config.accessToken ? decrypt(config.accessToken) : '';
            accessTokenPreview = mask(at, 4);
        } catch (e) {
            accessTokenPreview = '';
        }

        return res.json({
            enabled: !!rec.enabled,
            status: rec.status || 'disconnected',
            publicKey: publicKey, // público por diseño en MP
            accessTokenPreview,   // enmascarado
            hasWebhookSecret: !!config.webhookSecret,
            lastError: rec.lastError || null,
            lastCheckedAt: rec.lastCheckedAt || null,
        });
    } catch (err) {
        logger.error(`[integrations/mercadopago/status] ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

// POST /integrations/mercadopago/save  { accessToken, publicKey, webhookSecret }
// Valida las credenciales contra MP (/users/me) antes de persistir.
router.post('/mercadopago/save', async (req, res) => {
    const { accessToken, publicKey, webhookSecret } = req.body || {};

    if (!accessToken || !publicKey) {
        return res.status(400).json({ error: 'accessToken y publicKey son requeridos' });
    }

    // Validar contra MP
    try {
        const mpRes = await fetch('https://api.mercadopago.com/users/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!mpRes.ok) {
            const body = await mpRes.text();
            logger.warn(`[mercadopago/save] MP validation failed: ${mpRes.status} ${body}`);
            await patchIntegration('mercadopago', {
                status: 'error',
                lastError: `Credenciales inválidas (${mpRes.status})`,
            });
            return res.status(400).json({ error: `Credenciales inválidas (HTTP ${mpRes.status})` });
        }
        const user = await mpRes.json();
        logger.info(`[mercadopago/save] credenciales OK para MP user ${user?.id || 'unknown'}`);
    } catch (err) {
        logger.error(`[mercadopago/save] validación MP falló: ${err.message}`);
        await patchIntegration('mercadopago', { status: 'error', lastError: err.message });
        return res.status(500).json({ error: `No se pudo verificar con MP: ${err.message}` });
    }

    // Encriptar y persistir
    try {
        const config = {
            accessToken: encrypt(accessToken),
            publicKey: encrypt(publicKey),
            webhookSecret: webhookSecret ? encrypt(webhookSecret) : '',
        };
        await patchIntegration('mercadopago', {
            enabled: true,
            status: 'connected',
            config,
            lastError: '',
        });
        return res.json({ success: true });
    } catch (err) {
        logger.error(`[mercadopago/save] persist failed: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

// POST /integrations/mercadopago/test
// Crea una preference dummy de $1 para verificar que las credenciales guardadas
// siguen siendo válidas. No persiste nada.
router.post('/mercadopago/test', async (req, res) => {
    try {
        const rec = await getIntegration('mercadopago');
        const encToken = rec.config?.accessToken;
        if (!encToken) {
            return res.status(400).json({ error: 'Credenciales no configuradas' });
        }
        const accessToken = decrypt(encToken);

        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                items: [{ title: 'Drip Burger test', quantity: 1, unit_price: 1, currency_id: 'ARS' }],
            }),
        });

        if (!mpRes.ok) {
            const body = await mpRes.text();
            await patchIntegration('mercadopago', { status: 'error', lastError: `HTTP ${mpRes.status}` });
            return res.status(400).json({ success: false, error: `MP rechazó la prueba (${mpRes.status}): ${body.slice(0, 200)}` });
        }

        const pref = await mpRes.json();
        if (!pref.init_point) {
            return res.status(500).json({ success: false, error: 'MP no devolvió init_point' });
        }

        await patchIntegration('mercadopago', { status: 'connected', lastError: '' });
        return res.json({ success: true, initPoint: pref.init_point });
    } catch (err) {
        logger.error(`[mercadopago/test] ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST /integrations/mercadopago/disconnect
// Limpia las credenciales encriptadas y deja el estado disconnected, así el
// admin puede vincular otra cuenta desde la UI sin tocar PB a mano.
router.post('/mercadopago/disconnect', async (req, res) => {
    try {
        await patchIntegration('mercadopago', {
            enabled: false,
            status: 'disconnected',
            config: { accessToken: '', publicKey: '', webhookSecret: '' },
            lastError: '',
        });
        return res.json({ success: true });
    } catch (err) {
        logger.error(`[integrations/mercadopago/disconnect] ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

// POST /integrations/mercadopago/toggle  { enabled }
router.post('/mercadopago/toggle', async (req, res) => {
    const { enabled } = req.body || {};
    try {
        await patchIntegration('mercadopago', { enabled: !!enabled });
        return res.json({ success: true, enabled: !!enabled });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
