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
} from '../services/whatsappService.js';

const router = express.Router();

// Todas las rutas de /integrations requieren JWT admin
router.use(requireAdmin);

// ── Helpers para leer/escribir registros de integrations ─────────
const getIntegration = async (key) => {
    return pb.collection('integrations').getFirstListItem(`key="${key}"`, { requestKey: null });
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
// Responde el QR actual si ya hay uno, o status "connected" si ya estaba listo.
router.post('/whatsapp/connect', async (req, res) => {
    try {
        await patchIntegration('whatsapp', { enabled: true, status: 'pending_qr', lastError: '' });
        await initWhatsApp({ force: true });

        // Dar unos segundos para que el client emita QR o ready.
        // No bloqueamos más de 8s — el frontend hará polling /status.
        const start = Date.now();
        while (Date.now() - start < 8000) {
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

    try {
        const msg = `🍔 Test de conexión Drip Burger ✅\n\nSi estás leyendo esto, la integración con WhatsApp funciona perfecto.`;
        await sendMessage(phone, msg);
        return res.json({ success: true });
    } catch (err) {
        logger.error(`[integrations/whatsapp/test] ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
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
