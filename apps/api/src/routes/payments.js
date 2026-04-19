import express from 'express';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { decrypt } from '../utils/crypto.js';

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || process.env.API_URL || '';

const getMpAccessToken = async () => {
    const rec = await pb.collection('integrations').getFirstListItem('key="mercadopago"', { requestKey: null });
    const encToken = rec.config?.accessToken;
    if (!encToken) throw new Error('Mercado Pago no está configurado');
    if (!rec.enabled) throw new Error('Mercado Pago no está activo');
    return decrypt(encToken);
};

// POST /payments/create-preference  { orderId }
// Endpoint público: el cliente no tiene por qué estar logueado.
// Lee el order de PB, crea preference en MP y devuelve { preferenceId, initPoint }.
router.post('/create-preference', async (req, res) => {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId es requerido' });

    try {
        const order = await pb.collection('orders').getOne(orderId, { requestKey: null });

        const accessToken = await getMpAccessToken();
        const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
        const preference = new Preference(client);

        const total = Math.round(Number(order.totalAmount) || 0);
        if (total <= 0) {
            return res.status(400).json({ error: 'El monto del pedido es 0 o inválido' });
        }

        const title = `Drip Burger #${order.orderNumber || order.id}`;

        const result = await preference.create({
            body: {
                items: [{
                    id: String(order.id),
                    title,
                    quantity: 1,
                    unit_price: total,
                    currency_id: 'ARS',
                }],
                external_reference: String(order.id),
                back_urls: {
                    success: `${FRONTEND_URL}/pedido-confirmado/${order.id}`,
                    failure: `${FRONTEND_URL}/pedido-fallido/${order.id}`,
                    pending: `${FRONTEND_URL}/pedido-pendiente/${order.id}`,
                },
                auto_return: 'approved',
                notification_url: API_PUBLIC_URL
                    ? `${API_PUBLIC_URL}/payments/webhook`
                    : undefined,
                payer: order.customerEmail ? { email: order.customerEmail } : undefined,
                metadata: {
                    orderId: String(order.id),
                    orderNumber: order.orderNumber || '',
                },
            },
        });

        logger.info(`[payments/create-preference] order=${order.id} preference=${result.id}`);

        return res.json({
            preferenceId: result.id,
            initPoint: result.init_point || result.sandbox_init_point,
        });
    } catch (err) {
        const detail = err?.cause?.message || err?.response?.data || err.message;
        logger.error(`[payments/create-preference] failed: ${err.message} ${JSON.stringify(detail)}`);
        return res.status(500).json({ error: err.message || 'Error creando preferencia' });
    }
});

// POST /payments/webhook
// MP notifica acá cuando un pago cambia de estado. Siempre respondemos 200
// para que MP no reintente infinito — la lógica de fallos queda en logs.
router.post('/webhook', async (req, res) => {
    try {
        const body = req.body || {};
        const type = body.type || body.topic;
        const dataId = body.data?.id || body.resource || null;

        logger.info(`[payments/webhook] type=${type} dataId=${dataId}`);

        if (type !== 'payment' || !dataId) {
            return res.status(200).json({ ok: true, skipped: true });
        }

        const accessToken = await getMpAccessToken();
        const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: String(dataId) });

        const status = paymentInfo?.status; // approved | rejected | cancelled | pending | in_process
        const externalReference = paymentInfo?.external_reference;
        if (!externalReference) {
            logger.warn(`[payments/webhook] payment ${dataId} sin external_reference`);
            return res.status(200).json({ ok: true, skipped: true });
        }

        let patch = null;
        if (status === 'approved') {
            patch = { paymentStatus: 'Pagado' };
            logger.info(`[payments/webhook] order=${externalReference} payment=${dataId} APPROVED`);
        } else if (status === 'rejected' || status === 'cancelled') {
            logger.warn(`[payments/webhook] order=${externalReference} payment=${dataId} ${status.toUpperCase()}`);
        } else {
            logger.info(`[payments/webhook] order=${externalReference} payment=${dataId} status=${status}`);
        }

        if (patch) {
            try {
                await pb.collection('orders').update(externalReference, patch, { requestKey: null });
            } catch (pbErr) {
                logger.error(`[payments/webhook] PB update failed para order ${externalReference}: ${pbErr.message}`);
            }
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        logger.error(`[payments/webhook] error: ${err.message}`);
        // Siempre 200 para que MP no reintente infinitamente
        return res.status(200).json({ ok: false, error: err.message });
    }
});

// GET /payments/status/:orderId
// Permite al frontend chequear el estado actual del pago antes de mostrar "pagado ✓"
// (el webhook puede llegar con delay). Público.
router.get('/status/:orderId', async (req, res) => {
    try {
        const order = await pb.collection('orders').getOne(req.params.orderId, { requestKey: null });
        return res.json({
            orderId: order.id,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            orderStatus: order.orderStatus,
        });
    } catch (err) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }
});

export default router;
