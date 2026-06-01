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

// Puppeteer setup para Docker (alineado con Sinatra):
//   - executablePath: respeta PUPPETEER_EXECUTABLE_PATH (en compose se setea
//     /usr/bin/chromium). Sin esto, puppeteer busca su Chromium descargado
//     que no existe con `npm install --omit=dev`.
//   - --no-sandbox/--disable-setuid-sandbox: para correr como root en docker.
//   - --disable-dev-shm-usage: Docker default /dev/shm=64MB, Chromium crashea.
//   - --no-zygote y resto: bypasean los "Code 21" típicos de Chromium en
//     containers (zygote/user-ns fail).
const createClient = () => new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-default-browser-check',
            '--no-zygote',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--metrics-recording-only',
            '--mute-audio',
        ],
    },
});

/**
 * Borra el CONTENIDO de SESSION_DIR sin tocar el directorio en sí.
 * Importante: en prod SESSION_DIR es un mount point del named volume
 * `drip-wa-session`. Hacer `fs.rmSync(SESSION_DIR, ...)` falla con EBUSY
 * porque el kernel no permite rmdir sobre un mount activo. Borrando solo
 * los hijos (incluidos ocultos como SingletonLock) limpiamos la sesión
 * pero el volumen sigue montado y disponible.
 */
const wipeSessionContents = () => {
    if (!fs.existsSync(SESSION_DIR)) return;
    for (const entry of fs.readdirSync(SESSION_DIR)) {
        fs.rmSync(path.join(SESSION_DIR, entry), { recursive: true, force: true });
    }
};

/**
 * Mata cualquier lock file de Chromium en la sesión persistida. Sin esto,
 * si un Chromium anterior quedó zombie (process killed sin limpiar) el
 * próximo launch falla con "The profile appears to be in use by another
 * Chromium process" (Code 21). Es safe correrlo siempre antes de init.
 */
const clearChromiumLocks = () => {
    if (!fs.existsSync(SESSION_DIR)) return;
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (/^Singleton(Lock|Cookie|Socket)$/.test(entry.name)) {
                try { fs.rmSync(full, { force: true }); } catch (_) { /* ignore */ }
            }
        }
    };
    try { walk(SESSION_DIR); } catch (_) { /* ignore */ }
};

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
        const reasonStr = String(reason || '').toUpperCase();
        // Desvinculación remota (LOGOUT desde el celular del local) o
        // navegación forzada de WA Web: la sesión está MUERTA, no tiene
        // sentido retry — hay que destruir el client y esperar a que el
        // admin reconecte manualmente desde /gestion/config. Eso emitirá
        // un QR nuevo via initWhatsApp({ force: true, wipeSession: true }).
        const isPermanent = reasonStr.includes('LOGOUT') ||
            reasonStr.includes('NAVIGATION') ||
            reasonStr.includes('CONFLICT') ||
            reasonStr.includes('UNPAIRED');
        if (isPermanent) {
            logger.warn(`WhatsApp desvinculado remotamente (${reason}). Limpiando client — el admin debe reconectar manualmente.`);
            try { await client.destroy(); } catch (e) { /* noop */ }
            whatsappClient = null;
            lastQrCode = null;
            updateIntegrationRecord({ status: 'disconnected', lastError: `Desvinculado: ${reason}` });
            return;
        }
        // Desconexión transitoria (red caída, restart de WA Web, etc):
        // reintentar con el MISMO client en 5s. Esto cubre el caso "se
        // cortó internet del local" sin requerir intervención del admin.
        logger.warn(`WhatsApp desconectado (transitorio): ${reason}. Reintentando en 5s...`);
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
export const initWhatsApp = async ({ force = false, wipeSession = false } = {}) => {
    // Si force=true y ya había un client en memoria, destruirlo primero.
    // Sin esto, después de una desvinculación remota (el cliente del local
    // toca "cerrar sesión" en su celular), `whatsappClient` queda no-null
    // con una sesión muerta. El early-return retornaba el client viejo y
    // jamás se emitía un QR nuevo → pantalla de "Conectar" colgada.
    // Si además wipeSession=true, borramos la carpeta wa-session/ local
    // para garantizar QR fresco (re-pairing desde cero).
    if (force && whatsappClient) {
        try {
            await whatsappClient.destroy();
            logger.info('[whatsappService] client viejo destruido antes de reinicializar (force)');
        } catch (err) {
            logger.warn(`[whatsappService] destroy del client viejo falló (sigo igual): ${err?.message || err}`);
        }
        whatsappClient = null;
        ready = false;
        lastQrCode = null;
        statusInternal = 'disconnected';
    }
    if (force && wipeSession) {
        try {
            wipeSessionContents();
            logger.info('[whatsappService] wa-session/ contenido eliminado por wipeSession=true');
        } catch (err) {
            logger.warn(`[whatsappService] no pude borrar wa-session: ${err?.message || err}`);
        }
    }

    if (whatsappClient) return whatsappClient;

    if (!force) {
        const { exists, enabled } = await readIntegrationEnabled();
        if (exists && !enabled) {
            logger.info('[whatsappService] integrations.whatsapp.enabled = false — skip auto-init');
            return null;
        }
    }

    // Limpiar locks de Chromium zombie antes de iniciar — sin esto, si el
    // último Chromium murió sin limpiar, el nuevo falla con Code 21
    // "profile appears to be in use".
    clearChromiumLocks();

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
            wipeSessionContents();
            logger.info('[whatsappService] wa-session/ contenido eliminado');
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
