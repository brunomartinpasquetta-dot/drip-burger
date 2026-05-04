/// <reference path="../pb_data/types.d.ts" />
//
// Extiende el modelo de pagos para soportar 3 métodos:
//   - Efectivo
//   - Transferencia (= Mercado Pago, valor histórico mantenido)
//   - TransferenciaBancaria (NUEVO — transferencia bancaria manual con CBU/alias)
//
// paymentStatus ahora admite "Rechazado" además de "Pendiente" y "Pagado".
// Nota: los campos `paymentMethod` y `paymentStatus` actualmente son TextField,
// no SelectField. Mantenemos el TextField y validamos los valores admitidos
// vía hook + frontend, así no rompemos pedidos existentes con valores legacy.
// Esta migración no toca el schema; deja constancia del nuevo dominio del
// campo y backfilléa pedidos viejos si hace falta.
migrate((app) => {
  // Backfill de pedidos que pudieran haber quedado en estados ambiguos.
  // No tocamos los pedidos en `Pendiente` (siguen pendientes hasta cobro).
  // Sólo fijamos paymentStatus="Pagado" para pedidos con orderStatus="Finalizado"
  // que por algún motivo quedaron sin paymentStatus seteado (compat retro).
  try {
    const rows = app.findRecordsByFilter(
      "orders",
      `orderStatus = "Finalizado" && (paymentStatus = "" || paymentStatus = null)`,
      "",
      1000
    );
    for (const r of rows) {
      r.set("paymentStatus", "Pagado");
      app.save(r);
    }
  } catch (e) {
    // sin filas o collection vacía
  }
}, (app) => {
  // No revertimos backfill — irrelevante en down migration
  return;
});
