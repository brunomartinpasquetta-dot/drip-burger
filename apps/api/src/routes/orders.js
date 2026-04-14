import express from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { isReady, sendMessage } from '../services/whatsappService.js';

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

  try {
    const message = await sendMessage(customerPhone, messageText);
    logger.info(`WhatsApp enviado OK — order ${orderId} → ${customerPhone} (wa id: ${message?.id?._serialized || 'n/a'})`);
    return res.json({
      success: true,
      messageSent: true,
    });
  } catch (error) {
    logger.error(`WhatsApp send failed for order ${orderId}: ${error.message}`);
    return res.json({
      success: false,
      error: error.message,
    });
  }
});

export default router;