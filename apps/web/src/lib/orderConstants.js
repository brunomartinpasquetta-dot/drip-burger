export const ORDER_STATUS = {
  PENDING: 'Pendiente',
  COOKING: 'En preparación',
  READY: 'Listo',
  IN_TRANSIT: 'En camino',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

export const PAYMENT_STATUS = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  REJECTED: 'Rechazado',
};

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

// 3 métodos de pago. NOTA HISTÓRICA: el valor "Transferencia" originalmente
// se usaba para Mercado Pago (porque internamente la transferencia online vía
// MP era la única que existía). Ahora `MERCADOPAGO` es el alias claro de ese
// flujo y `TRANSFERENCIA_BANCARIA` es nuevo (cliente paga por CBU/alias y
// el admin valida manualmente). Mantenemos el value 'Transferencia' como
// alias de Mercado Pago por compat retro con pedidos viejos.
export const FORMA_PAGO = {
  CASH: 'Efectivo',
  // Mercado Pago — value histórico "Transferencia" para no romper pedidos
  // viejos ni la lógica del webhook MP. Usá esta key en código nuevo.
  MERCADOPAGO: 'Transferencia',
  TRANSFER: 'Transferencia',           // alias legacy = MERCADOPAGO
  TRANSFERENCIA_BANCARIA: 'TransferenciaBancaria',
};

export const FORMA_PAGO_VALUES = ['Efectivo', 'Transferencia', 'TransferenciaBancaria'];

// Label visible al cliente / admin
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
