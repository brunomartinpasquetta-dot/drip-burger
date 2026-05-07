import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';

// ── Cliente para PocketBase: lectura directa de la collection "integrations" ──
// Útil como fallback o para lecturas rápidas sin pasar por el API Node.
// IMPORTANTE: las rules de la collection exigen role=ADMIN — sólo funciona
// con un JWT admin en pb.authStore.

export const getIntegration = async (key) => {
    try {
        return await pb.collection('integrations').getFirstListItem(`key="${key}"`, { requestKey: null });
    } catch (err) {
        if (err?.status === 404) return null;
        throw err;
    }
};

export const updateIntegration = async (key, patch) => {
    const rec = await getIntegration(key);
    if (!rec) throw new Error(`Integration "${key}" no existe`);
    return pb.collection('integrations').update(rec.id, patch, { requestKey: null });
};

// ── Cliente para el API Node: endpoints con lógica server-side ────────────
// Wraps fetch con Authorization: Bearer <pb jwt> automáticamente.

const callApi = async (path, { method = 'GET', body } = {}) => {
    const token = pb.authStore.token;
    if (!token) {
        // Early-throw para evitar requests sin Authorization header. El caller
        // debería guardar el dispatch detrás de `isAuthReady` del AuthContext;
        // esto es la última barrera defensiva contra requests huérfanos.
        const err = new Error('No autenticado');
        err.status = 401;
        throw err;
    }
    const res = await apiServerClient.fetch(path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    // Defensa: si el endpoint apunta a un server equivocado (ej: VITE_API_URL
    // a un Vite de otro proyecto en el mismo puerto) la response es HTML y
    // res.json() falla. Antes devolvíamos null silencioso y los componentes
    // crasheaban con "Cannot read properties of null". Ahora tiramos error
    // explícito así los cards muestran "No se pudo cargar..." en vez de blanco.
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('application/json')) {
        const error = new Error('La API no responde JSON. Verificá que el server esté corriendo en VITE_API_URL.');
        error.status = res.status;
        throw error;
    }
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        const error = new Error('Respuesta inválida de la API');
        error.status = res.status;
        throw error;
    }
    if (!res.ok) {
        const error = new Error(data?.error || `HTTP ${res.status}`);
        error.status = res.status;
        error.data = data;
        throw error;
    }
    return data;
};

// ── WhatsApp ────────────────────────────────────────────────────
export const waStatus = () => callApi('/integrations/whatsapp/status');
export const waConnect = () => callApi('/integrations/whatsapp/connect', { method: 'POST' });
export const waDisconnect = () => callApi('/integrations/whatsapp/disconnect', { method: 'POST' });
export const waTest = (phone) => callApi('/integrations/whatsapp/test', { method: 'POST', body: { phone } });
export const waToggle = (enabled) => callApi('/integrations/whatsapp/toggle', { method: 'POST', body: { enabled } });

// ── Mercado Pago ────────────────────────────────────────────────
export const mpStatus = () => callApi('/integrations/mercadopago/status');
export const mpSave = (credentials) => callApi('/integrations/mercadopago/save', { method: 'POST', body: credentials });
export const mpTest = () => callApi('/integrations/mercadopago/test', { method: 'POST' });
export const mpToggle = (enabled) => callApi('/integrations/mercadopago/toggle', { method: 'POST', body: { enabled } });
export const mpDisconnect = () => callApi('/integrations/mercadopago/disconnect', { method: 'POST' });

export default {
    getIntegration,
    updateIntegration,
    waStatus,
    waConnect,
    waDisconnect,
    waTest,
    waToggle,
    mpStatus,
    mpSave,
    mpTest,
    mpToggle,
    mpDisconnect,
};
