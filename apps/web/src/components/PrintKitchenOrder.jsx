import React from 'react';

// ──────────────────────────────────────────────────────────────────
// PrintKitchenOrder — replica 1:1 el layout de escposPrinter.js.legacy
// (printKitchenOrder). Sin precios, sin dirección, sin pago.
//
// Estructura:
//   COMANDA COCINA          (CENTER + BOLD + DOUBLE_SIZE)
//   ===========
//   TURNO 21:00             (CENTER + BOLD + DOUBLE_SIZE)
//   ===========
//   NOMBRE CLIENTE          (BOLD + DOUBLE_HEIGHT)  ← por cada pedido
//   #ORD-NNNNNN
//     2x BACON DRIP x2med   (BOLD, indentado 2 espacios)
//     1x NUGGETS
//     + 2 papas fritas      (BOLD, sólo si hay)
//   ----------------         ← entre pedidos
//   ===========
//   N pedidos               (CENTER + BOLD)
//   N medallones
//   N papas fritas
// ──────────────────────────────────────────────────────────────────

const WIDTH = 32;
const SEP_EQ = '='.repeat(WIDTH);
const SEP_DASH = '-'.repeat(WIDTH);

const itemIncluyeFritas = (item) =>
  typeof item?.incluyeFritas === 'boolean'
    ? item.incluyeFritas
    : item?.hasMedallions !== false;

const PrintKitchenOrder = ({ orders, timeSlot }) => {
  const list = Array.isArray(orders) ? orders : (orders ? [orders] : []);
  if (list.length === 0) return null;

  // Totales finales del pie
  let totalMedallones = 0;
  let totalPapas = 0;
  for (const o of list) {
    for (const it of o.items || []) {
      const qty = Number(it.quantity) || 1;
      if (it.hasMedallions !== false) {
        totalMedallones += (Number(it.pattyCount) || 0) * qty;
      }
      if (itemIncluyeFritas(it)) totalPapas += qty;
    }
  }

  return (
    <div>
      <div className="ticket-center ticket-double">COMANDA COCINA</div>
      <div className="ticket-sep">{SEP_EQ}</div>
      <div className="ticket-center ticket-double">
        TURNO {timeSlot || 'TODOS'}
      </div>
      <div className="ticket-sep">{SEP_EQ}</div>

      {list.map((order, oi) => {
        const items = order.items || [];
        let papasDelPedido = 0;
        for (const it of items) {
          if (itemIncluyeFritas(it)) papasDelPedido += (Number(it.quantity) || 1);
        }
        return (
          <div key={order.id || oi}>
            <div className="ticket-double-height">
              {(order.customerName || 'SIN NOMBRE').toUpperCase()}
              {(order.takeAway || /^TAKE AWAY/i.test(order.customerAddress || '')) && ' [TAKE AWAY]'}
            </div>
            <div>#{order.orderNumber || order.id}</div>
            {items.map((item, idx) => {
              const qty = Number(item.quantity) || 1;
              const isBurger = item.hasMedallions !== false;
              const pattyLabel = isBurger && item.pattyCount
                ? ` x${item.pattyCount}med`
                : '';
              return (
                <div key={idx} className="ticket-bold">
                  &nbsp;&nbsp;{qty}x {(item.productName || '').toUpperCase()}{pattyLabel}
                </div>
              );
            })}
            {papasDelPedido > 0 && (
              <div className="ticket-bold">
                &nbsp;&nbsp;+ {papasDelPedido} papas fritas
              </div>
            )}
            {oi < list.length - 1 && (
              <div className="ticket-sep">{SEP_DASH}</div>
            )}
          </div>
        );
      })}

      <div className="ticket-sep">{SEP_EQ}</div>
      <div className="ticket-center ticket-bold">
        <div>{list.length} pedidos</div>
        <div>{totalMedallones} medallones</div>
        <div>{totalPapas} papas fritas</div>
      </div>
      <div className="ticket-spacer" />
    </div>
  );
};

export default PrintKitchenOrder;
