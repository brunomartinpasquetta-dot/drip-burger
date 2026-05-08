// Estados unificados del pedido. Las claves del enum son nombres en inglés
// para uso en código; los VALORES son los strings que viven en PB y aparecen
// al usuario tal cual.
// Valores que matchean EXACTAMENTE el SelectField orderStatus de PB.
// Se usan los valores legacy ("En camino", "Finalizado") porque la base
// de prod los tiene desde siempre y los datos guardados los usan.
// Los aliases SHIPPED/DELIVERED y los nuevos IN_TRANSIT/COMPLETED apuntan
// al mismo string para no romper imports existentes.
export const ORDER_STATUS = {
  PENDING: 'Pendiente',
  COOKING: 'En preparación',
  READY: 'Listo',
  SHIPPED: 'En camino',
  DELIVERED: 'Finalizado',
  CANCELLED: 'Cancelado',
  // Aliases (mismos valores)
  IN_TRANSIT: 'En camino',
  COMPLETED: 'Finalizado',
};

export const ORDER_STATUS_VALUES = ['Pendiente', 'En preparación', 'Listo', 'En camino', 'Finalizado', 'Cancelado'];
export const ORDER_STATUS_FLOW = ['Pendiente', 'En preparación', 'Listo', 'En camino', 'Finalizado'];

// Si algún dato quedó con los nombres modernos (Enviado/Entregado) por
// alguna corrida en local antes de revertir, lo mapeamos a los legacy
// para que la UI no muestre estados huérfanos.
export const normalizeOrderStatus = (value) => {
  if (value === 'Enviado') return 'En camino';
  if (value === 'Entregado') return 'Finalizado';
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
