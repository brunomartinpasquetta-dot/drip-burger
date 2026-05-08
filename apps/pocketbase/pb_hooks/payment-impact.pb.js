/// <reference path="../pb_data/types.d.ts" />
//
// Hook onRecordUpdate de orders. Tiene 2 responsabilidades:
//
// 1) BLOQUEAR FINALIZACIÓN SIN PAGO
//    Si orderStatus pasa a "Finalizado" y paymentStatus !== "Pagado",
//    rechazar con BadRequestError.
//
// 2) IMPACTO AUTOMÁTICO EN CAJA AL VALIDAR PAGO
//    Si paymentStatus pasa de cualquier valor (Pendiente/Rechazado) a "Pagado":
//      a) Verificar que haya jornada abierta. Si no, rechazar con error claro.
//      b) Crear registro en movimientos_caja con tipo=ingreso, monto=totalAmount,
//         motivo="Cobro pedido #orderNumber (metodoPago)", jornadaId=jornada activa.
//      c) Asignar jornadaId al pedido si no la tenía o la tenía de una jornada cerrada.
//
// IMPORTANTE: en Goja/PB los hooks corren en VM aislada. Helpers top-level
// no se ven dentro del callback. Todo helper inline dentro del callback.

onRecordUpdate((e) => {
  const newStatus = e.record.get("orderStatus");
  const newPayment = e.record.get("paymentStatus");

  // Snapshot del valor previo. PB JS hooks: e.record.original() devuelve un
  // proxy con los valores antes del save.
  const original = e.record.original();
  const oldStatus = original ? original.get("orderStatus") : "";
  const oldPayment = original ? original.get("paymentStatus") : "";

  // ── 1) Bloqueo finalizar sin pago ─────────────────────────────────
  if (newStatus === "Finalizado" && newPayment !== "Pagado") {
    throw new BadRequestError("No se puede finalizar un pedido sin cobro confirmado.");
  }

  // ── 2) Impacto en caja al validar pago ────────────────────────────
  // Detección: paymentStatus pasa de algo distinto a "Pagado" → "Pagado".
  // Evitamos disparar si el record ya estaba en Pagado y se actualiza otra cosa.
  const justPaid = newPayment === "Pagado" && oldPayment !== "Pagado";
  if (!justPaid) {
    e.next();
    return;
  }

  // Buscar jornada abierta
  let jornada = null;
  try {
    jornada = $app.findFirstRecordByFilter("jornadas", `estado = "abierta"`);
  } catch (err) {
    jornada = null;
  }
  if (!jornada) {
    throw new BadRequestError(
      "No hay jornada de caja abierta. Abrí una jornada antes de validar pagos."
    );
  }

  // Asignar jornadaId al pedido si falta o es de otra jornada
  const currentJornada = e.record.get("jornadaId");
  if (currentJornada !== jornada.id) {
    e.record.set("jornadaId", jornada.id);
  }

  // Crear movimiento_caja idempotente: chequear si ya existe uno para este
  // pedido (para evitar duplicados si el hook se dispara dos veces).
  const orderId = e.record.id;
  const orderNumber = e.record.get("orderNumber") || orderId;
  const method = e.record.get("paymentMethod") || "—";
  const totalAmount = Number(e.record.get("totalAmount") || 0);

  if (totalAmount > 0) {
    let alreadyExists = null;
    try {
      // Buscamos por motivo que incluya el orderNumber para idempotencia
      const motivoMarker = "Cobro pedido #" + orderNumber;
      alreadyExists = $app.findFirstRecordByFilter(
        "movimientos_caja",
        `jornadaId = "${jornada.id}" && motivo ~ "${orderNumber}"`
      );
    } catch (err) {
      alreadyExists = null;
    }

    if (!alreadyExists) {
      try {
        const movsCol = $app.findCollectionByNameOrId("movimientos_caja");
        const mov = new Record(movsCol);
        mov.set("jornadaId", jornada.id);
        mov.set("tipo", "ingreso");
        mov.set("monto", totalAmount);
        mov.set("motivo", "Cobro pedido #" + orderNumber + " (" + method + ")");
        // adminId opcional — el hook corre como sistema, sin auth de admin
        try {
          const adminId = e.auth ? e.auth.id : null;
          if (adminId) mov.set("adminId", adminId);
        } catch (errA) { /* noop */ }
        $app.save(mov);
      } catch (err) {
        console.log("[payment-impact] no pude crear movimiento_caja: " + (err && err.message ? err.message : err));
        // No bloqueamos el cobro si el movimiento falla — el resumen lee
        // de orders directo, así el cobro aparece igual.
      }
    }
  }

  e.next();
}, "orders");
