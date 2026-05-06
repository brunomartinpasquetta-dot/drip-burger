import express from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { isReady, sendMessage, normalizePhone } from '../services/whatsappService.js';

const router = express.Router();

// GET /orders/stats
router.get('/stats', async (req, res) => {
  const { fromDate, toDate } = req.query;

  // Input validation
  if (!fromDate) {
    return res.status(400).json({ error: 'fromDate query parameter is required (ISO format)' });
  }
  if (!toDate) {
    return res.status(400).json({ error: 'toDate query parameter is required (ISO format)' });
  }

  // Validate ISO format
  const fromDateObj = new Date(fromDate);
  const toDateObj = new Date(toDate);
  if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Use ISO format (YYYY-MM-DD or ISO 8601)' });
  }

  // Fetch orders from PocketBase with orderStatus='Finalizado' between dates
  const filter = `orderStatus='Finalizado' && createdAt>='${fromDate}' && createdAt<='${toDate}'`;
  const orders = await pb.collection('orders').getFullList({
    filter,
    expand: 'items',
  });

  logger.info(`Fetched ${orders.length} finalized orders between ${fromDate} and ${toDate}`);

  // Aggregate stats
  let totalOrders = 0;
  let totalCollected = 0;
  let efectivoTotal = 0;
  let transferenciaTotal = 0;
  const perTimeSlot = {};
  const productMap = {};

  orders.forEach((order) => {
    totalOrders += 1;
    totalCollected += order.totalAmount || 0;

    // Payment method aggregation
    if (order.paymentMethod === 'efectivo') {
      efectivoTotal += order.totalAmount || 0;
    } else if (order.paymentMethod === 'transferencia') {
      transferenciaTotal += order.totalAmount || 0;
    }

    // Per time slot aggregation
    const timeSlot = order.deliveryTimeSlot || 'unknown';
    if (!perTimeSlot[timeSlot]) {
      perTimeSlot[timeSlot] = 0;
    }
    perTimeSlot[timeSlot] += order.totalAmount || 0;

    // Most ordered products
    if (order.expand && order.expand.items && Array.isArray(order.expand.items)) {
      order.expand.items.forEach((item) => {
        const productName = item.productName || 'Unknown';
        if (!productMap[productName]) {
          productMap[productName] = { count: 0, revenue: 0 };
        }
        productMap[productName].count += item.quantity || 1;
        productMap[productName].revenue += item.subtotal || 0;
      });
    }
  });

  // Convert product map to sorted array
  const mostOrderedProducts = Object.entries(productMap)
    .map(([productName, data]) => ({
      productName,
      count: data.count,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate average ticket value
  const averageTicketValue = totalOrders > 0 ? totalCollected / totalOrders : 0;

  res.json({
    totalOrders,
    totalCollected,
    efectivoTotal,
    transferenciaTotal,
    perTimeSlot,
    mostOrderedProducts,
    averageTicketValue,
  });
});

// POST /orders/send-whatsapp
router.post('/send-whatsapp', async (req, res) => {
  const { orderId, customerPhone, customerName, deliveryTimeSlot } = req.body;

  // Input validation
  if (!orderId) {
    return res.status(400).json({ error: 'orderId is required' });
  }
  if (!customerPhone) {
    return res.status(400).json({ error: 'customerPhone is required' });
  }
  if (!customerName) {
    return res.status(400).json({ error: 'customerName is required' });
  }
  if (!deliveryTimeSlot) {
    return res.status(400).json({ error: 'deliveryTimeSlot is required' });
  }

  // Chequeamos primero si la integración de WhatsApp está habilitada en PB.
  // Si el admin la desactivó desde /gestion/config, hacemos skip sin intentar
  // mandar nada (aunque el client esté ready).
  try {
    const integ = await pb.collection('integrations').getFirstListItem('key="whatsapp"', { requestKey: null });
    if (!integ.enabled) {
      logger.info(`WhatsApp deshabilitado en config — skip para order ${orderId}`);
      return res.json({
        success: true,
        messageSent: false,
        reason: 'WhatsApp deshabilitado',
      });
    }
  } catch (err) {
    logger.warn(`[send-whatsapp] no pude leer integrations config: ${err?.message || err}`);
    // Continuamos en modo tolerante: si no podemos leer config, confiamos en isReady()
  }

  // Si WhatsApp todavía no terminó de inicializar (QR no escaneado, o
  // wa-session vacío) devolvemos una respuesta "skip" — el frontend sigue
  // avanzando el estado del pedido a En camino y muestra un warning.
  if (!isReady()) {
    logger.warn(`WhatsApp no inicializado — skip para order ${orderId}`);
    return res.json({
      success: true,
      messageSent: false,
      reason: 'WhatsApp no inicializado',
    });
  }

  const messageText =
    `🍔 ¡Hola ${customerName}! Tu pedido de Drip Burger está en camino.\n` +
    `Llega aprox a las ${deliveryTimeSlot}.\n` +
    `¡Gracias por elegirnos!`;

  // Normalizamos manualmente para loguear ambos formatos y diagnosticar
  // si la falla viene de un teléfono mal cargado en el pedido.
  const normalized = normalizePhone(customerPhone);
  logger.info(`[send-whatsapp] order=${orderId} phone="${customerPhone}" → normalized=${normalized}`);

  if (!normalized || normalized.length < 12) {
    const reason = `Teléfono inválido: "${customerPhone}" (normalizado: ${normalized})`;
    logger.warn(`[send-whatsapp] ${reason}`);
    return res.json({ success: false, error: reason });
  }

  try {
    const message = await sendMessage(customerPhone, messageText);
    logger.info(`WhatsApp enviado OK — order ${orderId} → ${normalized} (wa id: ${message?.id?._serialized || 'n/a'})`);
    return res.json({
      success: true,
      messageSent: true,
    });
  } catch (error) {
    logger.error(`WhatsApp send failed for order ${orderId} (phone "${customerPhone}" → ${normalized}): ${error.message}`);
    return res.json({
      success: false,
      error: error.message,
      phoneNormalized: normalized,
    });
  }
});

// POST /orders/send-bank-transfer-info
// Manda al cliente por WhatsApp los datos de transferencia bancaria (titular,
// alias, CBU) leídos del singleton `settings`, junto con el total a pagar y
// le pide que responda con la foto del comprobante. Se dispara desde el
// frontend justo después de crear el pedido cuando forma_pago=Transferencia.
//
// Mismo contrato de fallos que /send-whatsapp: si WA está deshabilitado o
// no inicializado, devuelve success:true con messageSent:false y razón.
// El frontend usa esa señal para mostrar fallback con los datos en pantalla.
router.post('/send-bank-transfer-info', async (req, res) => {
  const { orderId, customerPhone, customerName, totalAmount, orderNumber } = req.body;

  if (!orderId) return res.status(400).json({ error: 'orderId is required' });
  if (!customerPhone) return res.status(400).json({ error: 'customerPhone is required' });
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });

  // Chequeo de integración WhatsApp habilitada
  try {
    const integ = await pb.collection('integrations').getFirstListItem('key="whatsapp"', { requestKey: null });
    if (!integ.enabled) {
      logger.info(`[bank-transfer-info] WhatsApp deshabilitado — skip order ${orderId}`);
      return res.json({ success: true, messageSent: false, reason: 'WhatsApp deshabilitado' });
    }
  } catch (err) {
    logger.warn(`[bank-transfer-info] no pude leer integrations config: ${err?.message || err}`);
  }

  if (!isReady()) {
    logger.warn(`[bank-transfer-info] WhatsApp no inicializado — skip order ${orderId}`);
    return res.json({ success: true, messageSent: false, reason: 'WhatsApp no inicializado' });
  }

  // Leer datos bancarios del singleton settings
  let titular = '';
  let alias = '';
  let cbu = '';
  try {
    const settingsList = await pb.collection('settings').getList(1, 1, { requestKey: null });
    if (settingsList.items.length > 0) {
      const s = settingsList.items[0];
      titular = s.transferencia_titular || '';
      alias = s.transferencia_alias || '';
      cbu = s.transferencia_cbu || '';
    }
  } catch (err) {
    logger.warn(`[bank-transfer-info] no pude leer settings: ${err?.message || err}`);
  }

  if (!alias && !cbu && !titular) {
    logger.warn(`[bank-transfer-info] datos bancarios vacíos en settings — skip order ${orderId}`);
    return res.json({ success: true, messageSent: false, reason: 'Datos bancarios no configurados' });
  }

  const normalized = normalizePhone(customerPhone);
  if (!normalized || normalized.length < 12) {
    const reason = `Teléfono inválido: "${customerPhone}" (normalizado: ${normalized})`;
    logger.warn(`[bank-transfer-info] ${reason}`);
    return res.json({ success: false, error: reason });
  }

  const totalLine = totalAmount
    ? `Total a transferir: $${Math.round(Number(totalAmount)).toLocaleString('es-AR')}\n`
    : '';
  const numLine = orderNumber ? `Pedido #${orderNumber}\n` : '';
  const messageText =
    `🍔 ¡Hola ${customerName}! Recibimos tu pedido en Drip Burger.\n` +
    numLine +
    `${totalLine}\n` +
    `Para confirmarlo, transferí a:\n` +
    (titular ? `Titular: ${titular}\n` : '') +
    (alias ? `Alias: ${alias}\n` : '') +
    (cbu ? `CBU: ${cbu}\n` : '') +
    `\n📸 Respondé este mensaje con la foto del comprobante para validar tu pago. Sin comprobante no podemos confirmar el pedido. ¡Gracias!`;

  try {
    const message = await sendMessage(customerPhone, messageText);
    logger.info(`[bank-transfer-info] enviado OK — order ${orderId} → ${normalized} (wa id: ${message?.id?._serialized || 'n/a'})`);
    return res.json({ success: true, messageSent: true, phoneNormalized: normalized });
  } catch (error) {
    logger.error(`[bank-transfer-info] send failed for order ${orderId} (${normalized}): ${error.message}`);
    return res.json({ success: false, error: error.message, phoneNormalized: normalized });
  }
});

export default router;