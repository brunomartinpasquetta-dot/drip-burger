import React from 'react';
import { MEDALLION_LABELS, FORMA_PAGO, PAYMENT_STATUS } from '@/lib/orderConstants';

const fmtPrice = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0));

const formatDateTimeAr = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const ar = new Date(
      d.getTime() + (-3 * 60 * 60 * 1000) - d.getTimezoneOffset() * 60 * 1000
    );
    const dd = String(ar.getDate()).padStart(2, '0');
    const mm = String(ar.getMonth() + 1).padStart(2, '0');
    const yyyy = ar.getFullYear();
    const hh = String(ar.getHours()).padStart(2, '0');
    const min = String(ar.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
  } catch (e) {
    return '';
  }
};

// Snapshot helper con compat retro: orders viejos no traen incluyeFritas.
// Asumimos: hamburguesa (hasMedallions=true) → lleva fritas; nuggets → no.
const itemIncluyeFritas = (item) =>
  typeof item?.incluyeFritas === 'boolean'
    ? item.incluyeFritas
    : item?.hasMedallions !== false;

/**
 * Ticket de delivery — formato 80mm. Render plano del DOM; las clases
 * `.ticket-*` y el id #print-area las maneja index.css en @media print.
 */
const PrintTicketDelivery = ({ order }) => {
  if (!order) return null;

  const items = order.items || [];
  const shipping = Number(order.precio_envio_snapshot) || 0;
  const itemsTotal = items.reduce(
    (s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );
  const total = Number(order.totalAmount) || itemsTotal + shipping;

  const paymentMethod = order.paymentMethod || order.forma_pago || '—';
  const isCash = paymentMethod === FORMA_PAGO.CASH;
  const isPaid = order.paymentStatus === PAYMENT_STATUS.PAID;

  let estadoPago;
  if (isCash && !isPaid) estadoPago = `COBRAR ${fmtPrice(total)} EN EFECTIVO`;
  else if (isCash && isPaid) estadoPago = 'YA COBRADO · EFECTIVO';
  else if (isPaid) estadoPago = 'PAGADO ONLINE';
  else estadoPago = `PENDIENTE · ${paymentMethod.toUpperCase()}`;

  return (
    <>
      <div className="ticket-center">
        <h1>DRIP BURGER</h1>
      </div>
      <hr className="ticket-double" />

      <div>
        <div className="ticket-bold">PEDIDO #{order.orderNumber || order.id}</div>
        <div>{formatDateTimeAr(order.created)}</div>
        {order.deliveryTimeSlot && (
          <div className="ticket-bold">ENTREGA: {order.deliveryTimeSlot}</div>
        )}
      </div>

      <hr className="ticket-line" />

      <div>
        <div className="ticket-bold">CLIENTE: {(order.customerName || '—').toUpperCase()}</div>
        {order.customerPhone && <div>TEL: {order.customerPhone}</div>}
        <div className="ticket-bold" style={{ fontSize: '13px', marginTop: '2px' }}>
          DIRECCION: {(order.customerAddress || '—').toUpperCase()}
        </div>
      </div>

      <hr className="ticket-line" />

      <div>
        {items.length === 0 ? (
          <div>Sin ítems</div>
        ) : (
          items.map((item, idx) => {
            const qty = Number(item.quantity) || 1;
            const hasPatty = item.hasMedallions !== false && item.pattyCount;
            const pattyLabel = hasPatty
              ? ` ${MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}`.toUpperCase()
              : '';
            const lineTotal = (Number(item.price) || 0) * qty;
            return (
              <div key={idx} style={{ marginBottom: '2px' }}>
                <div className="ticket-row">
                  <span className="ticket-bold">
                    {qty}x {(item.productName || '').toUpperCase()}{pattyLabel}
                  </span>
                  <span className="ticket-bold ticket-tabular">{fmtPrice(lineTotal)}</span>
                </div>
                {itemIncluyeFritas(item) && (
                  <div style={{ paddingLeft: '8px' }}>+ papas fritas</div>
                )}
              </div>
            );
          })
        )}
      </div>

      <hr className="ticket-line" />

      <div className="ticket-row">
        <span>Subtotal:</span>
        <span className="ticket-tabular">{fmtPrice(itemsTotal)}</span>
      </div>
      <div className="ticket-row">
        <span>Envío:</span>
        <span className="ticket-tabular">{fmtPrice(shipping)}</span>
      </div>
      <hr className="ticket-line" />
      <div className="ticket-row">
        <h2 style={{ margin: 0 }}>TOTAL:</h2>
        <h2 style={{ margin: 0 }} className="ticket-tabular">{fmtPrice(total)}</h2>
      </div>

      <hr className="ticket-double" />

      <div className="ticket-center">
        <div className="ticket-bold" style={{ fontSize: '13px' }}>{estadoPago}</div>
      </div>

      <hr className="ticket-double" />

      <div className="ticket-center" style={{ marginTop: '6px' }}>
        ¡GRACIAS POR TU PEDIDO!
      </div>
    </>
  );
};

export default PrintTicketDelivery;
