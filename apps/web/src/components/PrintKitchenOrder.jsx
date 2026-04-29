import React from 'react';
import { MEDALLION_LABELS } from '@/lib/orderConstants';

const itemIncluyeFritas = (item) =>
  typeof item?.incluyeFritas === 'boolean'
    ? item.incluyeFritas
    : item?.hasMedallions !== false;

/**
 * Comanda de cocina — sin precios, sin dirección, sin pago.
 * Sólo lo que necesita el cocinero: nombre, hora de entrega, items con
 * medallones y fritas, notas. Soporta uno o varios pedidos juntos.
 */
const PrintKitchenOrder = ({ orders, timeSlot }) => {
  const list = Array.isArray(orders) ? orders : (orders ? [orders] : []);
  if (list.length === 0) return null;

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
    <>
      <div className="ticket-center">
        <h1>COMANDA COCINA</h1>
        <h2>TURNO {timeSlot || 'TODOS'}</h2>
      </div>
      <hr className="ticket-double" />

      {list.map((order, oi) => {
        const items = order.items || [];
        let papasDelPedido = 0;
        for (const it of items) {
          if (itemIncluyeFritas(it)) papasDelPedido += (Number(it.quantity) || 1);
        }
        return (
          <div key={order.id || oi} style={{ marginBottom: '6px' }}>
            <div className="ticket-bold" style={{ fontSize: '13px' }}>
              {(order.customerName || 'SIN NOMBRE').toUpperCase()}
            </div>
            <div>
              #{order.orderNumber || order.id}
              {order.deliveryTimeSlot && <> · ENTREGA {order.deliveryTimeSlot}</>}
            </div>
            <div style={{ marginTop: '2px' }}>
              {items.map((item, idx) => {
                const qty = Number(item.quantity) || 1;
                const isBurger = item.hasMedallions !== false;
                const pattyLabel = isBurger && item.pattyCount
                  ? ` ${MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}`.toUpperCase()
                  : '';
                return (
                  <div key={idx}>
                    <span className="ticket-bold">
                      &nbsp;&nbsp;{qty}x {(item.productName || '').toUpperCase()}{pattyLabel}
                    </span>
                  </div>
                );
              })}
              {papasDelPedido > 0 && (
                <div className="ticket-bold">&nbsp;&nbsp;+ {papasDelPedido} PAPAS FRITAS</div>
              )}
              {order.notas && (
                <div style={{ marginTop: '2px' }}>NOTA: {order.notas}</div>
              )}
            </div>
            {oi < list.length - 1 && <hr className="ticket-line" />}
          </div>
        );
      })}

      <hr className="ticket-double" />
      <div className="ticket-center">
        <div className="ticket-bold">{list.length} pedidos</div>
        <div>{totalMedallones} medallones</div>
        <div>{totalPapas} papas fritas</div>
      </div>
    </>
  );
};

export default PrintKitchenOrder;
