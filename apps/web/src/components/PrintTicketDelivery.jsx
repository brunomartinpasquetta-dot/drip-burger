import React from 'react';
import { FORMA_PAGO, PAYMENT_STATUS } from '@/lib/orderConstants';

// ──────────────────────────────────────────────────────────────────
// PrintTicketDelivery — replica 1:1 el layout de escposPrinter.js.legacy
// (printDeliveryTicket). Mismo orden de secciones, mismas líneas
// separadoras (32 chars literales), mismas jerarquías de tamaño.
//
// Mapping ESC/POS → CSS:
//   NORMAL_SIZE        → base (.ticket-base 12px)
//   BOLD_ON            → .ticket-bold (font-weight 700)
//   DOUBLE_HEIGHT      → .ticket-double-height (~18px bold)
//   DOUBLE_SIZE        → .ticket-double (~22px bold black, doble alto+ancho)
//   CENTER             → .ticket-center (text-align center)
//   LEFT               → default
//   separator('=', 32) → 32 caracteres "=" literales
//   separator('-', 32) → 32 caracteres "-" literales
//   separator('*', 32) → 32 caracteres "*" literales
//   line('')           → <br/> (line feed)
//   FEED_3             → .ticket-spacer (margin-bottom)
//   lineWithPrice      → .ticket-row (flex space-between)
// ──────────────────────────────────────────────────────────────────

const WIDTH = 32;
const SEP_EQ = '='.repeat(WIDTH);
const SEP_DASH = '-'.repeat(WIDTH);
const SEP_STAR = '*'.repeat(WIDTH);

const fmtPrice = (n) =>
  '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');

// Snapshot helper con compat retro: orders viejos no traen incluyeFritas.
// Asumimos: hamburguesa (hasMedallions=true) → lleva fritas; nuggets → no.
const itemIncluyeFritas = (item) =>
  typeof item?.incluyeFritas === 'boolean'
    ? item.incluyeFritas
    : item?.hasMedallions !== false;

const PrintTicketDelivery = ({ order }) => {
  if (!order) return null;

  const items = order.items || [];
  const shipping = Number(order.precio_envio_snapshot) || 0;
  const itemsTotal = items.reduce(
    (s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );
  const total = Number(order.totalAmount) || itemsTotal + shipping;

  const paymentMethod = order.paymentMethod || order.forma_pago || '';
  const isCash = paymentMethod === FORMA_PAGO.CASH;
  const isTransfer = paymentMethod === FORMA_PAGO.TRANSFER;
  const isPaid = order.paymentStatus === PAYMENT_STATUS.PAID;

  return (
    <div>
      {/* HEADER — DOUBLE_SIZE + BOLD + CENTER */}
      <div className="ticket-center ticket-double">DRIP BURGER</div>
      <div className="ticket-sep">{SEP_EQ}</div>

      {/* META — BOLD número, normal entrega */}
      <div className="ticket-bold">#{order.orderNumber || order.id}</div>
      {order.deliveryTimeSlot && (
        <div>Entrega: {order.deliveryTimeSlot}</div>
      )}
      <div className="ticket-sep">{SEP_EQ}</div>

      {/* CLIENTE — DOUBLE_HEIGHT + BOLD nombre, BOLD tel */}
      <div className="ticket-double-height">
        {(order.customerName || '').toUpperCase()}
      </div>
      {order.customerPhone && (
        <div className="ticket-bold">Tel: {order.customerPhone}</div>
      )}

      {/* línea vacía + DIRECCIÓN o badge TAKE AWAY (doble tamaño) */}
      <br />
      <div className="ticket-double">
        {(order.takeAway || /^TAKE AWAY/i.test(order.customerAddress || ''))
          ? '*** TAKE AWAY ***'
          : (order.customerAddress || '-').toUpperCase()}
      </div>
      <div className="ticket-sep">{SEP_EQ}</div>

      {/* ITEMS — BOLD label + price right-aligned + "+ PAPAS FRITAS" indentado */}
      {items.map((item, idx) => {
        const qty = Number(item.quantity) || 1;
        const hasPatty = item.hasMedallions !== false && item.pattyCount;
        const pattyLabel = hasPatty ? ` x${item.pattyCount}med` : '';
        const label = `${qty}x ${(item.productName || '').toUpperCase()}${pattyLabel}`;
        const lineTotal = (Number(item.price) || 0) * qty;
        return (
          <div key={idx}>
            <div className="ticket-row ticket-bold">
              <span>{label}</span>
              <span>{fmtPrice(lineTotal)}</span>
            </div>
            {itemIncluyeFritas(item) && (
              <div>&nbsp;&nbsp;+ PAPAS FRITAS</div>
            )}
          </div>
        );
      })}

      <div className="ticket-sep">{SEP_DASH}</div>
      <div className="ticket-row">
        <span>Subtotal:</span>
        <span>{fmtPrice(itemsTotal)}</span>
      </div>
      <div className="ticket-row">
        <span>Envio:</span>
        <span>{fmtPrice(shipping)}</span>
      </div>
      <div className="ticket-sep">{SEP_DASH}</div>

      {/* TOTAL — DOUBLE_HEIGHT + BOLD */}
      <div className="ticket-row ticket-double-height">
        <span>TOTAL:</span>
        <span>{fmtPrice(total)}</span>
      </div>

      {/* ESTADO DE PAGO — frame con asteriscos + DOUBLE_SIZE centrado */}
      <div className="ticket-sep">{SEP_STAR}</div>
      <div className="ticket-center">
        {isCash && !isPaid && (
          <>
            <div className="ticket-double">COBRAR</div>
            <div className="ticket-double">{fmtPrice(total)}</div>
            <div className="ticket-double-height">EFECTIVO</div>
          </>
        )}
        {isCash && isPaid && (
          <>
            <div className="ticket-double">YA COBRADO</div>
            <div className="ticket-double-height">EFECTIVO</div>
          </>
        )}
        {isTransfer && (
          <>
            <div className="ticket-double">PAGADO</div>
            <div className="ticket-double-height">TRANSFERENCIA</div>
          </>
        )}
        {!isCash && !isTransfer && (
          <div className="ticket-double">
            {isPaid ? 'PAGADO' : `COBRAR ${fmtPrice(total)}`}
          </div>
        )}
      </div>
      <div className="ticket-sep">{SEP_STAR}</div>

      <br />
      <div className="ticket-center">Gracias por tu pedido!</div>
      <div className="ticket-spacer" />
    </div>
  );
};

export default PrintTicketDelivery;
