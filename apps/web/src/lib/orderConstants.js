export const ORDER_STATUS = {
  PENDING: 'Pendiente',
  COOKING: 'En preparación',
  READY: 'Listo',
  IN_TRANSIT: 'En camino',
  COMPLETED: 'Finalizado',
};

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

export const PAYMENT_STATUS = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
};

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

export const FORMA_PAGO = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
};

export const FORMA_PAGO_VALUES = Object.values(FORMA_PAGO);
