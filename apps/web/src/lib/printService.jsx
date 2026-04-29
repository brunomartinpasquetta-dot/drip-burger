// Servicio de impresión multiplataforma — usa window.print() del navegador
// y el driver del sistema operativo. Compatible con cualquier impresora
// (térmica 80mm, A4, red, WiFi). Sin drivers especiales del navegador.
//
// Flujo:
//   1) Mount del componente React correspondiente en #print-area (ReactDOM root)
//   2) body.classList.add('printing') + flush sincrónico
//   3) window.print()  (modal del navegador)
//   4) afterprint → unmount + remove class
//
// Si afterprint no se dispara (Safari raro), un timeout de 10s limpia igual.

import React from 'react';
import { createRoot } from 'react-dom/client';
import PrintTicketDelivery from '@/components/PrintTicketDelivery.jsx';
import PrintKitchenOrder from '@/components/PrintKitchenOrder.jsx';

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
  }
};

const printNode = async (node) => {
  const area = getPrintArea();
  if (!area) throw new Error('No se pudo encontrar el área de impresión');

  // Asegurar que cualquier impresión previa quedó limpia
  cleanup();

  return new Promise((resolve, reject) => {
    try {
      const root = createRoot(area);
      activeRoot = root;
      root.render(node);

      // Marca el body para activar el CSS de impresión y dar 1 frame
      // a React para flushear el DOM antes de invocar print().
      document.body.classList.add('printing');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const onAfter = () => {
            window.removeEventListener('afterprint', onAfter);
            cleanup();
            resolve();
          };
          window.addEventListener('afterprint', onAfter, { once: true });

          // Fallback por si afterprint no se dispara (algunos Safari)
          cleanupTimer = setTimeout(() => {
            window.removeEventListener('afterprint', onAfter);
            cleanup();
            resolve();
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
 */
export async function printTicketDelivery(order) {
  if (!order) throw new Error('Falta el pedido para imprimir');
  await printNode(<PrintTicketDelivery order={order} />);
}

/**
 * Imprime una comanda de cocina. Acepta un pedido o un array de pedidos.
 * @param {Object|Array<Object>} orders
 * @param {string} [timeSlot]
 */
export async function printKitchenOrder(orders, timeSlot) {
  const list = Array.isArray(orders) ? orders : (orders ? [orders] : []);
  if (list.length === 0) throw new Error('No hay pedidos para imprimir');
  await printNode(<PrintKitchenOrder orders={list} timeSlot={timeSlot} />);
}

/**
 * Ticket dummy para verificar que la impresión está bien configurada
 * desde /gestion/config.
 */
export async function printTestTicket() {
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
  await printTicketDelivery(dummyOrder);
}
