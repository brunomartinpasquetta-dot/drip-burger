// Servicio de impresión multiplataforma — usa window.print() del navegador
// y el driver del sistema operativo. Compatible con cualquier impresora
// (térmica POS-58, POS-80, A4, red, WiFi). Sin drivers especiales.
//
// Flujo:
//   1) Mount del componente React correspondiente en #print-area (ReactDOM root)
//   2) body.classList.add('printing') + body.classList.add('printing-58|80')
//   3) window.print()
//   4) afterprint → unmount + remove classes
//
// Si afterprint no se dispara (Safari raro), un timeout de 10s limpia igual.
//
// El ancho ('58'|'80') decide el layout via CSS body.printing-58/80. Default
// '80' por compat — drip-burger venía operando con 80mm.

import React from 'react';
import { createRoot } from 'react-dom/client';
import PrintTicketDelivery from '@/components/PrintTicketDelivery.jsx';
import PrintKitchenOrder from '@/components/PrintKitchenOrder.jsx';
import PrintCierreCaja from '@/components/PrintCierreCaja.jsx';

let activeRoot = null;
let cleanupTimer = null;

const getPrintArea = () => {
  if (typeof document === 'undefined') return null;
  let area = document.getElementById('print-area');
  if (!area) {
    // Fallback: si el index.html no lo tiene, lo creamos en runtime
    area = document.createElement('div');
    area.id = 'print-area';
    document.body.appendChild(area);
  }
  return area;
};

const cleanup = () => {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
  if (activeRoot) {
    try { activeRoot.unmount(); } catch (e) { /* noop */ }
    activeRoot = null;
  }
  if (typeof document !== 'undefined') {
    document.body.classList.remove('printing');
    document.body.classList.remove('printing-58');
    document.body.classList.remove('printing-80');
  }
};

const printNode = async (node, width = '80') => {
  const area = getPrintArea();
  if (!area) throw new Error('No se pudo encontrar el área de impresión');

  // Asegurar que cualquier impresión previa quedó limpia
  cleanup();

  return new Promise((resolve, reject) => {
    try {
      const root = createRoot(area);
      activeRoot = root;
      root.render(node);

      // Marca el body para activar el CSS de impresión y dar 2 frames a
      // React + el browser para flushear el DOM antes de invocar print().
      // Sin esto, en Chrome a veces el window.print() agarra el área vacía.
      document.body.classList.add('printing');
      // Layout 58 o 80 mm — el CSS body.printing-58/80 hace el override
      // del width, padding y font-size del #print-area.
      document.body.classList.add(width === '58' ? 'printing-58' : 'printing-80');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const finish = () => {
            setTimeout(() => {
              cleanup();
              resolve();
            }, 0);
          };

          const onAfter = () => {
            window.removeEventListener('afterprint', onAfter);
            finish();
          };
          window.addEventListener('afterprint', onAfter, { once: true });

          // Fallback por si afterprint no se dispara (algunos Safari)
          cleanupTimer = setTimeout(() => {
            window.removeEventListener('afterprint', onAfter);
            finish();
          }, 10000);

          try {
            window.print();
          } catch (err) {
            cleanup();
            reject(err);
          }
        });
      });
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
};

// ── API pública ─────────────────────────────────────────────────

/**
 * Imprime un ticket de delivery (con dirección, total, estado de pago).
 * @param {Object} order
 * @param {'58'|'80'} [width='80']
 */
export async function printTicketDelivery(order, width = '80') {
  if (!order) throw new Error('Falta el pedido para imprimir');
  await printNode(<PrintTicketDelivery order={order} />, width);
}

/**
 * Imprime una comanda de cocina. Acepta un pedido o un array de pedidos.
 * @param {Object|Array<Object>} orders
 * @param {string} [timeSlot]
 * @param {'58'|'80'} [width='80']
 */
export async function printKitchenOrder(orders, timeSlot, width = '80') {
  const list = Array.isArray(orders) ? orders : (orders ? [orders] : []);
  if (list.length === 0) throw new Error('No hay pedidos para imprimir');
  await printNode(<PrintKitchenOrder orders={list} timeSlot={timeSlot} />, width);
}

/**
 * Imprime el ticket de cierre de jornada (caja).
 * @param {Object} data — totales y metadata de la jornada (ver PrintCierreCaja).
 * @param {'58'|'80'} [width='80']
 */
export async function printCierreCaja(data, width = '80') {
  if (!data) throw new Error('No hay datos de jornada para imprimir');
  await printNode(<PrintCierreCaja data={data} />, width);
}

/**
 * Ticket dummy para verificar que la impresión está bien configurada
 * desde /gestion/config.
 * @param {'58'|'80'} [width='80']
 */
export async function printTestTicket(width = '80') {
  const dummyOrder = {
    id: 'TEST',
    orderNumber: 'TEST-' + new Date().toLocaleTimeString('es-AR'),
    customerName: 'Cliente de prueba',
    customerPhone: '342-000-0000',
    customerAddress: 'San Martín 1500, Coronda',
    deliveryTimeSlot: '21:00',
    created: new Date().toISOString(),
    items: [
      { productName: 'BACON DRIP', quantity: 1, pattyCount: 2, price: 8000, hasMedallions: true, incluyeFritas: true },
      { productName: 'NUGGETS', quantity: 1, pattyCount: 0, price: 3500, hasMedallions: false, incluyeFritas: false },
    ],
    precio_envio_snapshot: 1500,
    totalAmount: 13000,
    paymentMethod: 'Efectivo',
    paymentStatus: 'Pendiente',
  };
  await printTicketDelivery(dummyOrder, width);
}
