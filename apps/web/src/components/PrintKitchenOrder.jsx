import React from 'react';

// ──────────────────────────────────────────────────────────────────
// PrintKitchenOrder — comanda de cocina agrupada por TURNO horario.
//
// Estructura del ticket:
//
//   Bloque por turno (page-break entre turnos):
//     ┌───────────────────────────┐
//     │      COMANDA COCINA       │   (DOUBLE_SIZE, center)
//     │  ====================     │
//     │       ★ 21:00 hs ★         │   (DOUBLE_SIZE, center, header destacado)
//     │  ====================     │
//     │                           │
//     │   NOMBRE CLIENTE [TA?]    │   (DOUBLE_HEIGHT)
//     │   #ORD-NNNNNN             │
//     │     2x BACON DRIP x2med   │
//     │     1x NUGGETS            │
//     │     + 2 papas fritas      │
//     │   ─────────────────────   │
//     │   OTRO CLIENTE            │
//     │   ...                     │
//     └───────────────────────────┘
//
//   Hoja final (sólo si hay >1 pedido total): RESUMEN con total medallones+papas.
//
// Agrupación:
//   - Sort chronológico de slots ascendente (20:30 → 23:00).
//   - Pedidos sin deliveryTimeSlot → grupo "Sin horario" al final.
//
// El prop `timeSlot` queda como hint: si lo pasan distinto a 'TODOS' y todos
// los pedidos comparten ese slot, lo respetamos como header. Default agrupa.
// ──────────────────────────────────────────────────────────────────

const WIDTH = 32;
const SEP_EQ = '='.repeat(WIDTH);
const SEP_DASH = '-'.repeat(WIDTH);

const itemIncluyeFritas = (item) =>
  typeof item?.incluyeFritas === 'boolean'
    ? item.incluyeFritas
    : item?.hasMedallions !== false;

// page-break para que cada turno arranque "limpio" en la térmica
// y la cocina pueda cortar entre turnos.
const PAGE_BREAK_STYLE = {
  breakAfter: 'page',
  pageBreakAfter: 'always',
  breakInside: 'avoid',
  pageBreakInside: 'avoid',
};

const NO_SLOT_KEY = '__sin_horario__';

const groupBySlot = (orders) => {
  const groups = new Map();
  for (const o of orders) {
    const slot = o.deliveryTimeSlot && String(o.deliveryTimeSlot).trim()
      ? String(o.deliveryTimeSlot).trim()
      : NO_SLOT_KEY;
    if (!groups.has(slot)) groups.set(slot, []);
    groups.get(slot).push(o);
  }
  // Ordenar las claves: timeSlots HH:MM cronológicos primero, "sin horario" al final.
  const slotKeys = Array.from(groups.keys()).filter(k => k !== NO_SLOT_KEY).sort();
  const ordered = slotKeys.map(k => [k, groups.get(k)]);
  if (groups.has(NO_SLOT_KEY)) ordered.push([NO_SLOT_KEY, groups.get(NO_SLOT_KEY)]);
  return ordered;
};

const renderOrderItems = (order) => {
  const items = order.items || [];
  let papasDelPedido = 0;
  for (const it of items) {
    if (itemIncluyeFritas(it)) papasDelPedido += (Number(it.quantity) || 1);
  }
  const isTakeAway = order.takeAway || /^TAKE AWAY/i.test(order.customerAddress || '');
  return (
    <>
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
    </>
  );
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

  const groups = groupBySlot(list);
  const showResumen = list.length > 1 && groups.length > 1;

  return (
    <div>
      {groups.map(([slotKey, slotOrders], gi) => {
        const isLastGroup = gi === groups.length - 1 && !showResumen;
        const slotLabel = slotKey === NO_SLOT_KEY ? 'SIN HORARIO' : `${slotKey} hs`;
        return (
          <div key={slotKey} style={isLastGroup ? { breakInside: 'avoid', pageBreakInside: 'avoid' } : PAGE_BREAK_STYLE}>
            {/* Encabezado del bloque — siempre destacado, mismo tamaño DOUBLE */}
            <div className="ticket-center ticket-double">COMANDA COCINA</div>
            <div className="ticket-sep">{SEP_EQ}</div>
            <div className="ticket-center ticket-double">★ {slotLabel} ★</div>
            <div className="ticket-sep">{SEP_EQ}</div>
            <div className="ticket-center ticket-bold">
              {slotOrders.length} {slotOrders.length === 1 ? 'pedido' : 'pedidos'}
            </div>
            <div className="ticket-spacer" />

            {/* Pedidos del turno, separados por línea de guiones */}
            {slotOrders.map((order, oi) => (
              <div key={order.id || oi}>
                {renderOrderItems(order)}
                {oi < slotOrders.length - 1 && (
                  <div className="ticket-sep">{SEP_DASH}</div>
                )}
              </div>
            ))}

            <div className="ticket-spacer" />
          </div>
        );
      })}

      {/* Hoja final de RESUMEN — sólo si hay más de un turno */}
      {showResumen && (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div className="ticket-center ticket-double">RESUMEN</div>
          <div className="ticket-center ticket-double">{timeSlot && timeSlot !== 'TODOS' ? `TURNO ${timeSlot}` : 'TODOS LOS TURNOS'}</div>
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
