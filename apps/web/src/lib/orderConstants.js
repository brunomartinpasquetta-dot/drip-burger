// Estados unificados del pedido. Las claves del enum son nombres en inglés
// para uso en código; los VALORES son los strings que viven en PB y aparecen
// al usuario tal cual. Renombramos `IN_TRANSIT`→`SHIPPED` y `COMPLETED`→`DELIVERED`
// para alinear con el flujo: Pendiente → En preparación → Listo → Enviado → Entregado.
export const ORDER_STATUS = {
  PENDING: 'Pendiente',
  COOKING: 'En preparación',
  READY: 'Listo',
  SHIPPED: 'Enviado',         // antes "En camino"
  DELIVERED: 'Entregado',     // antes "Finalizado"
  CANCELLED: 'Cancelado',
  // Aliases legacy para no romper imports existentes durante el refactor.
  // Apuntan a los mismos valores nuevos. Marcar como deprecated.
  IN_TRANSIT: 'Enviado',
  COMPLETED: 'Entregado',
};

export const ORDER_STATUS_VALUES = ['Pendiente', 'En preparación', 'Listo', 'Enviado', 'Entregado', 'Cancelado'];

// Estados activos en el flujo de cocina/delivery (excluye Cancelado).
export const ORDER_STATUS_FLOW = ['Pendiente', 'En preparación', 'Listo', 'Enviado', 'Entregado'];

// Mapeo viejo→nuevo para migrar/normalizar al leer:
//   "En camino"   → "Enviado"
//   "Finalizado"  → "Entregado"
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

// Labels más explícitos para mostrar al admin.
export const PAYMENT_STATUS_LABELS = {
  Pendiente: 'Pendiente de pago',
  Pagado: 'Cobrado',
  Rechazado: 'Rechazado',
};

// 3 métodos de pago. NOTA HISTÓRICA: el valor "Transferencia" originalmente
// se usaba para Mercado Pago (porque internamente la transferencia online vía
// MP era la única que existía). Ahora `MERCADOPAGO` es el alias claro de ese
// flujo y `TRANSFERENCIA_BANCARIA` es nuevo (cliente paga por CBU/alias y
// el admin valida manualmente). Mantenemos el value 'Transferencia' como
// alias de Mercado Pago por compat retro con pedidos viejos.
export const FORMA_PAGO = {
  CASH: 'Efectivo',
  MERCADOPAGO: 'Transferencia',
  TRANSFER: 'Transferencia',           // alias legacy
  TRANSFERENCIA_BANCARIA: 'TransferenciaBancaria',
};

export const FORMA_PAGO_VALUES = ['Efectivo', 'Transferencia', 'TransferenciaBancaria'];

// Label visible al cliente / admin (largo).
export const FORMA_PAGO_LABELS = {
  Efectivo: 'Efectivo al recibir',
  Transferencia: 'Pagar online (Mercado Pago)',
  TransferenciaBancaria: 'Transferencia bancaria',
};

// Label corto para mostrar en cards del admin (debajo del monto).
export const FORMA_PAGO_LABELS_SHORT = {
  Efectivo: 'Efectivo',
  Transferencia: 'Pago online',
  TransferenciaBancaria: 'Transferencia',
};

export const MEDALLION_LABELS = {
  1: 'Simple',
  2: 'Doble',
  3: 'Triple',
  4: 'Cuádruple',
  5: 'Quíntuple',
};
