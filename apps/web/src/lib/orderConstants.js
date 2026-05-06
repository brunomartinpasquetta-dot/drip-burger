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
// Forma de pago — IMPORTANTE
//
// El schema PB de orders.forma_pago es un SelectField con SÓLO estos
// valores: ['Efectivo', 'Transferencia']. Cualquier otro string tira
// validation_invalid_value al crear el pedido.
//
// UI distingue 3 opciones (Efectivo, Mercado Pago, Transferencia bancaria)
// pero al submit se mapean a los 2 valores del schema. El frontend
// distingue MP vs bank transfer mediante un campo separado de UI choice
// (no se persiste en orders).
//
// Si en el futuro se aplica la migración 1777700000 que extiende el
// select a `['Efectivo', 'Transferencia', 'Mercado Pago']`, podés migrar
// el código a usar valores distintos sin colisión cambiando MERCADOPAGO
// abajo a 'Mercado Pago'.
// ──────────────────────────────────────────────────────────────────

// FORMA_PAGO — VALORES DEL SCHEMA (los que se persisten en PB)
export const FORMA_PAGO = {
  CASH: 'Efectivo',
  // MP y Transferencia bancaria comparten value en schema actual
  MERCADOPAGO: 'Transferencia',
  TRANSFER: 'Transferencia',                    // alias legacy
  TRANSFERENCIA_BANCARIA: 'Transferencia',      // alias = MERCADOPAGO en schema
};

export const FORMA_PAGO_VALUES = ['Efectivo', 'Transferencia'];

// UI CHOICES — los strings con los que el usuario interactúa en el frontend.
// Distintos de los schema values para poder distinguir MP de bank transfer.
export const FORMA_PAGO_UI = {
  EFECTIVO: 'Efectivo',
  MERCADOPAGO: 'MercadoPago',
  TRANSFERENCIA_BANCARIA: 'TransferenciaBancaria',
};

// Mapper UI choice → schema value (lo que se envía a PB en el create)
export const uiChoiceToSchema = (uiChoice) => {
  switch (uiChoice) {
    case FORMA_PAGO_UI.EFECTIVO:
      return FORMA_PAGO.CASH;
    case FORMA_PAGO_UI.MERCADOPAGO:
    case FORMA_PAGO_UI.TRANSFERENCIA_BANCARIA:
      return FORMA_PAGO.TRANSFER;
    default:
      return uiChoice; // fallback: si ya es schema-valid lo dejamos pasar
  }
};

// Resuelve el UI choice de un order leyendo `ui_payment_choice` si está
// presente. Para orders viejos (anteriores a la migración 1777800000) cae
// a heurística: efectivo → Efectivo; transferencia → MercadoPago (porque
// históricamente el value "Transferencia" era exclusivo de MP antes de
// agregar transferencia bancaria manual).
export const getOrderUiChoice = (order) => {
  if (!order) return FORMA_PAGO_UI.EFECTIVO;
  if (order.ui_payment_choice) return order.ui_payment_choice;
  const m = order.paymentMethod || order.forma_pago;
  if (m === FORMA_PAGO.CASH) return FORMA_PAGO_UI.EFECTIVO;
  if (m === FORMA_PAGO.TRANSFER) return FORMA_PAGO_UI.MERCADOPAGO;
  return m;
};

// Label largo para el cliente al elegir
export const FORMA_PAGO_UI_LABELS = {
  Efectivo: 'Efectivo al recibir',
  MercadoPago: 'Pagar online (Mercado Pago)',
  TransferenciaBancaria: 'Transferencia bancaria',
};

// Label corto para mostrar en cards del admin (debajo del monto). Se calcula
// sobre paymentMethod (schema value) — si es "Transferencia" no podemos
// distinguir MP de bank en este punto sin info adicional.
export const FORMA_PAGO_LABELS_SHORT = {
  Efectivo: 'Efectivo',
  Transferencia: 'Pago online',
};

// Compat con código que esperaba 3 entradas
FORMA_PAGO_LABELS_SHORT.TransferenciaBancaria = 'Transferencia';

// Label largo histórico (se mantiene para no romper imports existentes)
export const FORMA_PAGO_LABELS = {
  Efectivo: 'Efectivo al recibir',
  Transferencia: 'Pagar online (Mercado Pago)',
  TransferenciaBancaria: 'Transferencia bancaria',
};

export const MEDALLION_LABELS = {
  1: 'Simple',
  2: 'Doble',
  3: 'Triple',
  4: 'Cuádruple',
  5: 'Quíntuple',
};
