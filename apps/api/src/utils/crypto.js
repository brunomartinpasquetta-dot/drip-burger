import crypto from 'node:crypto';
import logger from './logger.js';

// AES-256-GCM encryption para credenciales sensibles (ej. access tokens de MP).
// La key se carga de process.env.ENCRYPTION_KEY (hex de 32 bytes = 64 chars).
// Si no está seteada, genera una temporal al arrancar (WARN) — esto es útil
// en dev pero rompe la persistencia entre restarts, así que en prod hay que
// setear la env var explícitamente.
//
// Genera una key nueva con: openssl rand -hex 32

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recomendado
const AUTH_TAG_LENGTH = 16;

const loadKey = () => {
    const hex = process.env.ENCRYPTION_KEY;
    if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
        return Buffer.from(hex, 'hex');
    }
    const generated = crypto.randomBytes(32);
    logger.warn(`[crypto] ENCRYPTION_KEY no seteada o inválida — usando key temporal ${generated.toString('hex').slice(0, 8)}... Credenciales persistidas ahora NO podrán descifrarse tras restart.`);
    return generated;
};

const KEY = loadKey();

/**
 * Encripta un string plano y devuelve un blob base64 con formato:
 *   iv.authTag.ciphertext  (cada parte codificada base64, joined con ".")
 * Si plain es null/undefined/empty devuelve string vacío.
 */
export const encrypt = (plain) => {
    if (plain === null || plain === undefined || plain === '') return '';
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
        const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return [
            iv.toString('base64'),
            authTag.toString('base64'),
            encrypted.toString('base64'),
        ].join('.');
    } catch (err) {
        logger.error(`[crypto.encrypt] failed: ${err.message}`);
        throw err;
    }
};

/**
 * Descifra un blob producido por encrypt(). Retorna '' si el input es vacío.
 * Tira si el ciphertext es inválido, la key cambió, o el authTag no matchea.
 */
export const decrypt = (cipherText) => {
    if (!cipherText) return '';
    try {
        const parts = String(cipherText).split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid ciphertext format');
        }
        const [ivB64, tagB64, dataB64] = parts;
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(tagB64, 'base64');
        const data = Buffer.from(dataB64, 'base64');

        if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
            throw new Error('Invalid iv or authTag length');
        }

        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (err) {
        logger.error(`[crypto.decrypt] failed: ${err.message}`);
        throw err;
    }
};

/**
 * Enmascara un string para exponerlo a la UI. Por defecto muestra los últimos
 * 4 caracteres y los previos como "●".
 */
export const mask = (value, visible = 4) => {
    if (!value) return '';
    const str = String(value);
    if (str.length <= visible) return '●'.repeat(str.length);
    return '●'.repeat(Math.max(4, str.length - visible)) + str.slice(-visible);
};

export default { encrypt, decrypt, mask };
