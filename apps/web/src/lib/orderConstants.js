// Estados unificados del pedido. Las claves del enum son nombres en inglés
// para uso en código; los VALORES son los strings que viven en PB y aparecen
// al usuario tal cual.
export const ORDER_STATUS = {
  PENDING: 'Pendiente',
  COOKING: 'En preparación',
  READY: 'Listo',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  // Aliases legacy
  IN_TRANSIT: 'Enviado',
  COMPLETED: 'Entregado',
};

export const ORDER_STATUS_VALUES = ['Pendiente', 'En preparación', 'Listo', 'Enviado', 'Entregado', 'Cancelado'];
export const ORDER_STATUS_FLOW = ['Pendiente', 'En preparación', 'Listo', 'Enviado', 'Entregado'];

export const normalizeOrderStatus = (value) => {
  if (value === 'En camino') return 'Enviado';
  if (value === 'Finalizado') return 'Entregado';
  return value;
};

export const PAYMENT_STATUS = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  REJECTED: 'Rechazado',
};

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

export const PAYMENT_STATUS_LABELS = {
  Pendiente: 'Pendiente de pago',
  Pagado: 'Cobrado',
  Rechazado: 'Rechazado',
};

// ──────────────────────────────────────────────────────────────────
// Forma de pago — 3 valores que coinciden EXACTAMENTE con el SelectField
// PB de orders.forma_pago tras aplicar la migración 1777700000:
//   ['Efectivo', 'Transferencia', 'Mercado Pago']
// El frontend manda directo cualquiera de estos 3, sin mapeos intermedios.
// ──────────────────────────────────────────────────────────────────
export const FORMA_PAGO = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',     // transferencia bancaria manual (CBU/alias)
  MERCADOPAGO: 'Mercado Pago',        // pago online vía MP (webhook automático)
};

export const FORMA_PAGO_VALUES = Object.values(FORMA_PAGO);

// Label largo para el cliente al elegir
export const FORMA_PAGO_LABELS = {
  Efectivo: 'Efectivo al recibir',
  Transferencia: 'Transferencia bancaria',
  'Mercado Pago': 'Pagar online (Mercado Pago)',
};

// Label corto para mostrar en cards del admin (debajo del monto)
export const FORMA_PAGO_LABELS_SHORT = {
  Efectivo: 'Efectivo',
  Transferencia: 'Transferencia',
  'Mercado Pago': 'Pago online',
};

export const MEDALLION_LABELS = {
  1: 'Simple',
  2: 'Doble',
  3: 'Triple',
  4: 'Cuádruple',
  5: 'Quíntuple',
};
