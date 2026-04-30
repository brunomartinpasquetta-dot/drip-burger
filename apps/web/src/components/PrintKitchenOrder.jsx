import React from 'react';

// ──────────────────────────────────────────────────────────────────
// PrintKitchenOrder — un ticket POR pedido (page-break entre cada uno).
// Cuando se imprime más de uno, cada comanda sale en su propia hoja
// para que la térmica corte entre ellas y la cocina las separe.
//
// Estructura por ticket:
//   COMANDA COCINA          (DOUBLE_SIZE)
//   TURNO 21:00             (DOUBLE_SIZE)
//   ===========
//   NOMBRE CLIENTE          (DOUBLE_HEIGHT)
//   #ORD-NNNNNN
//     2x BACON DRIP x2med   (BOLD, indentado)
//     1x NUGGETS
//     + 2 papas fritas      (BOLD, sólo si hay)
//
// Después de todos los pedidos, una hoja final con el RESUMEN total.
// ──────────────────────────────────────────────────────────────────

const WIDTH = 32;
const SEP_EQ = '='.repeat(WIDTH);

const itemIncluyeFritas = (item) =>
  typeof item?.incluyeFritas === 'boolean'
    ? item.incluyeFritas
    : item?.hasMedallions !== false;

// Inline para que cada bloque rompa página al imprimir.
// Combinamos ambas propiedades por compatibilidad: `break-after` (moderno)
// y `page-break-after` (legacy, todavía respetado por Chrome al imprimir).
const PAGE_BREAK_STYLE = {
  breakAfter: 'page',
  pageBreakAfter: 'always',
};

const PrintKitchenOrder = ({ orders, timeSlot }) => {
  const list = Array.isArray(orders) ? orders : (orders ? [orders] : []);
  if (list.length === 0) return null;

  // Totales agregados — van en la última hoja.
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

  const turnoLabel = timeSlot || 'TODOS';
  const showResumen = list.length > 1;

  return (
    <div>
      {list.map((order, oi) => {
        const items = order.items || [];
        let papasDelPedido = 0;
        for (const it of items) {
          if (itemIncluyeFritas(it)) papasDelPedido += (Number(it.quantity) || 1);
        }
        const isTakeAway = order.takeAway || /^TAKE AWAY/i.test(order.customerAddress || '');
        // Cada pedido (excepto el último cuando NO hay resumen) corta página.
        const isLast = oi === list.length - 1 && !showResumen;
        return (
          <div key={order.id || oi} style={isLast ? undefined : PAGE_BREAK_STYLE}>
            <div className="ticket-center ticket-double">COMANDA COCINA</div>
            <div className="ticket-center ticket-double">TURNO {turnoLabel}</div>
            <div className="ticket-sep">{SEP_EQ}</div>

            <div className="ticket-double-height">
              {(order.customerName || 'SIN NOMBRE').toUpperCase()}
              {isTakeAway && ' [TAKE AWAY]'}
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
            <div className="ticket-spacer" />
          </div>
        );
      })}

      {/* Hoja final de RESUMEN — sólo si hay más de un pedido */}
      {showResumen && (
        <div>
          <div className="ticket-center ticket-double">RESUMEN</div>
          <div className="ticket-center ticket-double">TURNO {turnoLabel}</div>
          <div className="ticket-sep">{SEP_EQ}</div>
          <div className="ticket-center ticket-bold">
            <div>{list.length} pedidos</div>
            <div>{totalMedallones} medallones</div>
            <div>{totalPapas} papas fritas</div>
          </div>
          <div className="ticket-spacer" />
        </div>
      )}
    </div>
  );
};

export default PrintKitchenOrder;
