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
    const res = await apiServerClient.fetch(path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        data = null;
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
};
