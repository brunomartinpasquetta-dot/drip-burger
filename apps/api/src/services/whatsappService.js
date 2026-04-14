import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const { Client, LocalAuth } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistencia de sesión en disco — al lado del código del API para que
// sobreviva a restarts sin requerir escanear QR de nuevo.
const SESSION_DIR = path.resolve(__dirname, '../../wa-session');

let whatsappClient = null;
let ready = false;
let lastQrCode = null;       // Raw QR string del último evento "qr"
let statusInternal = 'disconnected'; // 'disconnected' | 'pending_qr' | 'connected' | 'error'
let lastErrorMsg = null;
let connectedPhone = null;

const createClient = () => new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

/**
 * Normaliza un teléfono argentino al formato internacional aceptado por WhatsApp:
 * 54 + 9 + código de área + número → ej. 5493425123456
 *
 * Casos cubiertos (Argentina):
 *   "+54 9 342 512 3456"      → 5493425123456
 *   "03425-123456"            → 5493425123456 (strip leading 0, insert 9)
 *   "342 15 512 3456"         → 5493425123456 (strip leading "15" móvil legacy)
 *   "3425123456"              → 5493425123456 (prepend 54 + 9)
 */
export const normalizePhone = (phone) => {
    if (!phone) return '';

    let digits = String(phone).replace(/[^0-9]/g, '');

    let hasCountryCode = false;
    if (digits.startsWith('54')) {
        digits = digits.slice(2);
        hasCountryCode = true;
    }

    if (hasCountryCode && digits.startsWith('9')) {
        digits = digits.slice(1);
    }

    if (digits.startsWith('0')) {
        digits = digits.slice(1);
    }

    const areaLengths = [2, 3, 4];
    for (const al of areaLengths) {
        if (digits.length >= al + 2 && digits.substr(al, 2) === '15' && digits.length - 2 >= 10) {
            digits = digits.slice(0, al) + digits.slice(al + 2);
            break;
        }
    }

    return `549${digits}`;
};

// ── Persistencia de estado en PocketBase ──────────────────────────
const updateIntegrationRecord = async (patch) => {
    try {
        const rec = await pb.collection('integrations').getFirstListItem('key="whatsapp"', { requestKey: null });
        await pb.collection('integrations').update(rec.id, {
            ...patch,
            lastCheckedAt: new Date().toISOString(),
        }, { requestKey: null });
    } catch (err) {
        // Si PB no está listo o no hay superuser auth, solo loggeamos
        logger.warn(`[whatsappService] no pude actualizar integrations.whatsapp: ${err?.message || err}`);
    }
};

// ── Lectura de estado de configuración ───────────────────────────
const readIntegrationEnabled = async () => {
    try {
        const rec = await pb.collection('integrations').getFirstListItem('key="whatsapp"', { requestKey: null });
        return { exists: true, enabled: !!rec.enabled, record: rec };
    } catch (err) {
        return { exists: false, enabled: false, record: null };
    }
};

// ── Listeners del cliente de WhatsApp ────────────────────────────
const attachListeners = (client) => {
    client.on('qr', (qr) => {
        lastQrCode = qr;
        statusInternal = 'pending_qr';
        logger.info('WhatsApp QR recibido — escaneá con el celular del negocio:');
        qrcode.generate(qr, { small: true });
        updateIntegrationRecord({ status: 'pending_qr', lastError: '' });
    });

    client.on('ready', async () => {
        ready = true;
        statusInternal = 'connected';
        lastQrCode = null;
        lastErrorMsg = null;
        try {
            const info = client.info;
            connectedPhone = info?.wid?.user ? `+${info.wid.user}` : null;
        } catch (e) {
            connectedPhone = null;
        }
        logger.info(`WhatsApp client listo y autenticado${connectedPhone ? ` (${connectedPhone})` : ''}`);
        updateIntegrationRecord({
            status: 'connected',
            enabled: true,
            config: { sessionExists: true, phoneNumber: connectedPhone || '' },
            lastError: '',
        });
    });

    client.on('authenticated', () => {
        logger.info('WhatsApp autenticación OK — sesión persistida');
    });

    client.on('auth_failure', (msg) => {
        ready = false;
        statusInternal = 'error';
        lastErrorMsg = String(msg);
        logger.error(`WhatsApp auth_failure: ${msg}`);
        updateIntegrationRecord({ status: 'error', lastError: String(msg) });
    });

    client.on('disconnected', async (reason) => {
        ready = false;
        statusInternal = 'disconnected';
        lastErrorMsg = String(reason);
        logger.warn(`WhatsApp desconectado: ${reason}. Reintentando en 5s...`);
        updateIntegrationRecord({ status: 'disconnected', lastError: String(reason) });
        setTimeout(() => {
            try {
                client.initialize();
            } catch (err) {
                logger.error(`WhatsApp reconnect failed: ${err.message}`);
            }
        }, 5000);
    });
};

/**
 * Inicializa el cliente de WhatsApp si integrations.whatsapp.enabled === true.
 * Idempotente: si ya existe client, no re-inicializa.
 * NO bloquea el event loop — initialize() es async y el caller típicamente
 * la llama sin await después de app.listen().
 *
 * @param {{ force?: boolean }} opts - force=true ignora el flag "enabled" de PB
 *   (útil para el endpoint /connect que dispara init por pedido explícito del admin)
 */
export const initWhatsApp = async ({ force = false } = {}) => {
    if (whatsappClient) return whatsappClient;

    if (!force) {
        const { exists, enabled } = await readIntegrationEnabled();
        if (exists && !enabled) {
            logger.info('[whatsappService] integrations.whatsapp.enabled = false — skip auto-init');
            return null;
        }
    }

    whatsappClient = createClient();
    attachListeners(whatsappClient);
    whatsappClient.initialize().catch((err) => {
        statusInternal = 'error';
        lastErrorMsg = err.message;
        logger.error(`WhatsApp initialize failed: ${err.message}`);
        updateIntegrationRecord({ status: 'error', lastError: err.message });
    });
    return whatsappClient;
};

export const isReady = () => ready;

export const getClient = () => whatsappClient;

export const getStatus = () => ({
    status: statusInternal,
    ready,
    lastError: lastErrorMsg,
    phoneNumber: connectedPhone,
});

export const getQrCode = () => lastQrCode;

/**
 * Envía un mensaje de texto. Tira si el cliente no está listo o si WhatsApp
 * rechaza el envío (número inválido, no existe en WA, etc).
 */
export const sendMessage = async (phone, text) => {
    if (!whatsappClient || !ready) {
        throw new Error('WhatsApp client no inicializado');
    }
    const normalized = normalizePhone(phone);
    const chatId = `${normalized}@c.us`;
    const message = await whatsappClient.sendMessage(chatId, text);
    return message;
};

/**
 * Cierra limpiamente el cliente y opcionalmente borra la sesión persistida
 * (para forzar un re-scan de QR en la próxima conexión).
 */
export const destroyWhatsApp = async ({ wipeSession = false } = {}) => {
    if (whatsappClient) {
        try {
            await whatsappClient.destroy();
        } catch (err) {
            logger.error(`WhatsApp destroy failed: ${err.message}`);
        }
    }
    ready = false;
    lastQrCode = null;
    statusInternal = 'disconnected';
    connectedPhone = null;
    whatsappClient = null;

    if (wipeSession) {
        try {
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                logger.info('[whatsappService] wa-session/ eliminada');
            }
        } catch (err) {
            logger.error(`[whatsappService] no pude borrar wa-session: ${err.message}`);
        }
    }

    await updateIntegrationRecord({
        status: 'disconnected',
        config: { sessionExists: wipeSession ? false : (fs.existsSync(SESSION_DIR)), phoneNumber: '' },
    });
    logger.info('WhatsApp client destruido');
};

export default {
    initWhatsApp,
    isReady,
    getClient,
    getStatus,
    getQrCode,
    sendMessage,
    destroyWhatsApp,
    normalizePhone,
};
