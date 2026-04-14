import dotenv from 'dotenv';
dotenv.config();
import Pocketbase from 'pocketbase';
import logger from './logger.js';

const POCKETBASE_HOST = process.env.POCKETBASE_URL || 'http://localhost:8090';

// Credenciales del "API service user" — usuario con role=ADMIN que el API
// usa para operaciones internas (leer/escribir integrations, settings, etc).
// Defaults sensatos para dev; en prod hay que setearlos explícitamente.
const API_USER_EMAIL = process.env.PB_API_USER_EMAIL || 'admin@drip.com';
const API_USER_PASSWORD = process.env.PB_API_USER_PASSWORD || 'admin123';

async function waitForHealth({ retries = 10, delayMs = 1000 } = {}) {
    for (let i = 1; i <= retries; i++) {
        const response = await fetch(`${POCKETBASE_HOST}/api/health`, { method: 'HEAD' });
        if (response.ok) {
            return;
        }

        logger.warn(`PocketBase not ready, retrying (${i}/${retries})...`);

        await new Promise((r) => setTimeout(r, delayMs));
    }

    throw new Error(`PocketBase health check failed after ${retries} retries`);
}

const pocketbaseClient = new Pocketbase(POCKETBASE_HOST);

pocketbaseClient.autoCancellation(false);

let authPromise = null;

// Interceptor que garantiza que cada request del singleton lleve el token
// del API service user. Si el token expiró o no existe, re-auth lazy.
pocketbaseClient.beforeSend = async function (url, options) {
    if (url.includes('/api/collections/users/auth-with-password')) {
        return { url, options };
    }

    if (!pocketbaseClient.authStore.isValid && !authPromise) {
        authPromise = pocketbaseClient.collection('users').authWithPassword(
            API_USER_EMAIL,
            API_USER_PASSWORD,
        ).catch((err) => {
            logger.warn(`PocketBase API user auth failed: ${err.message}`);
        }).finally(() => {
            authPromise = null;
        });
    }

    if (authPromise) {
        await authPromise;
    }

    if (pocketbaseClient.authStore.isValid && pocketbaseClient.authStore.token) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = pocketbaseClient.authStore.token;
    }

    return { url, options };
};

(async () => {
    try {
        await waitForHealth();
        logger.info(`PocketBase reachable at ${POCKETBASE_HOST}`);
    } catch (err) {
        logger.warn(`PocketBase health check failed: ${err.message}. API will start anyway; endpoints that need PB will fail lazily.`);
        return;
    }

    try {
        await pocketbaseClient.collection('users').authWithPassword(API_USER_EMAIL, API_USER_PASSWORD);
        const model = pocketbaseClient.authStore.model;
        if (model?.role !== 'ADMIN') {
            logger.warn(`PocketBase API user ${API_USER_EMAIL} no tiene role=ADMIN (${model?.role || 'none'}). Operaciones admin-only fallarán.`);
        } else {
            logger.info(`PocketBase API user autenticado: ${API_USER_EMAIL}`);
        }
    } catch (err) {
        logger.warn(`PocketBase API user auth failed: ${err.message}`);
    }
})();

export default pocketbaseClient;
export { pocketbaseClient };
