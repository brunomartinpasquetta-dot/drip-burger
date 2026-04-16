/// <reference path="../pb_data/types.d.ts" />
//
// Hook de creación de pedidos:
// 1) Valida capacidad por medallones del slot (hard gate server-side)
// 2) Asigna orderNumber + estados iniciales
//
// IMPORTANTE: En PocketBase/Goja los callbacks de hooks corren en un VM
// aislado. Las funciones declaradas en el top-level del archivo NO están
// disponibles dentro del callback. Todos los helpers deben estar inlined.
// Ref: https://pocketbase.io/docs/js-overview/#limitations
//
// Para leer JSON fields usamos record.getString(field) + JSON.parse,
// porque record.get(field) devuelve un wrapper Go (types.JsonRaw) que
// no pasa Array.isArray() en JS.

onRecordCreate((e) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = year + month + day;

  // ── Helpers inlined (Goja VM aislado no ve top-level) ───────────
  // Intenta múltiples estrategias para leer un JSON field como array JS:
  // 1) getString + JSON.parse (funciona en algunos casos)
  // 2) get() + JSON.stringify + JSON.parse (force conversion via json marshal)
  // 3) iteración directa del wrapper Go si es iterable
  const parseJsonArray = (record, field) => {
    // Estrategia 1: getString
    try {
      const str = record.getString(field);
      if (str && typeof str === "string") {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (x) {}
    // Estrategia 2: get() + stringify + parse
    try {
      const raw = record.get(field);
      if (raw != null) {
        const str2 = JSON.stringify(raw);
        if (str2 && str2 !== "null") {
          const parsed2 = JSON.parse(str2);
          if (Array.isArray(parsed2)) return parsed2;
        }
      }
    } catch (x) {}
    return [];
  };

  // Suma defensiva: clampa negativos a 0 para que data mala (pattyCount < 0,
  // quantity < 0) de orders viejos no "regale" capacidad. Para órdenes nuevas
  // hacemos un reject hard antes de llamar esta función.
  const sumMedallions = (items) => {
    let total = 0;
    for (const item of items) {
      if (!item) continue;
      if (item.hasMedallions === false) continue;
      const patty = Math.max(0, Number(item.pattyCount) || 0);
      const qty = Math.max(0, Number(item.quantity) || 0);
      total += patty * qty;
    }
    return total;
  };

  // Detecta si algún item del pedido entrante tiene valores inválidos
  // (negativos o no-numéricos que parezcan intencionales).
  const hasInvalidItemValues = (items) => {
    for (const item of items) {
      if (!item) continue;
      const patty = Number(item.pattyCount);
      const qty = Number(item.quantity);
      if (Number.isNaN(patty) || Number.isNaN(qty)) return true;
      if (patty < 0 || qty < 0) return true;
    }
    return false;
  };

  // ── Validación de capacidad por medallones ──────────────────────
  const slot = e.record.get("deliveryTimeSlot");
  if (slot) {
    let blockingError = null;

    try {
      // 1. Leer maxMedallionsPerSlot de settings (default 20)
      const settingsRecords = $app.findRecordsByFilter("settings", `id != ""`, "", 1);
      const settings = settingsRecords && settingsRecords.length > 0 ? settingsRecords[0] : null;
      const rawMax = settings ? settings.get("maxMedallionsPerSlot") : null;
      const maxMedallions = rawMax != null ? Number(rawMax) : 20;

      // 2. Medallones del pedido entrante. Rechazar si hay valores negativos
      //    para evitar bypass de capacidad con pattyCount/quantity negativos.
      const newItems = parseJsonArray(e.record, "items");
      if (hasInvalidItemValues(newItems)) {
        blockingError = "Valores inválidos en el pedido (cantidades o medallones negativos).";
      } else {
        const newOrderMedallions = sumMedallions(newItems);

        // 3. Medallones ya agendados en el slot del día (excluyendo Cancelado)
        // PB almacena datetime como "YYYY-MM-DD HH:MM:SS.sssZ" (espacio, no T).
        // toISOString() usa T, lo cual hace fallar la comparación lexicográfica
        // contra el formato de DB. Convertimos T→espacio para que match.
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().replace("T", " ");
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString().replace("T", " ");
        const filter = `deliveryTimeSlot = "${slot}" && created >= "${todayStart}" && created < "${todayEnd}" && orderStatus != "Cancelado"`;
        const existing = $app.findRecordsByFilter("orders", filter, "", 1000);

        let usedMedallions = 0;
        if (existing) {
          for (const ord of existing) {
            const ordItems = parseJsonArray(ord, "items");
            usedMedallions += sumMedallions(ordItems);
          }
        }

        console.log("[slot-capacity] slot=" + slot + " used=" + usedMedallions + " new=" + newOrderMedallions + " max=" + maxMedallions);

        // 4. Gate
        if (usedMedallions + newOrderMedallions > maxMedallions) {
          const remaining = Math.max(0, maxMedallions - usedMedallions);
          blockingError = "El horario " + slot + " solo tiene " + remaining + " medallones disponibles, tu pedido requiere " + newOrderMedallions + ". Elegí otra tanda o reducí la cantidad.";
        }
      }
    } catch (err) {
      // Error de DB/lectura: fail-open para no bloquear por un bug del hook.
      // Pero logueamos para poder diagnosticar.
      console.log("slot capacity check failed softly: " + (err && err.message ? err.message : err));
    }

    // Propagar el error de capacidad FUERA del try para evitar que sea
    // tragado por el catch (y así el cliente recibe un 400 user-facing).
    if (blockingError) {
      throw new BadRequestError(blockingError);
    }
  }

  // ── Asignar jornada abierta (si existe) al pedido ────────────────
  // Si hay una jornada con estado="abierta", el pedido se asocia a ella
  // para que el cierre de caja pueda agregar totales por jornada.
  // Si no hay jornada abierta, jornadaId queda null (el pedido igual se crea).
  try {
    const jornadaRec = $app.findFirstRecordByFilter("jornadas", `estado = "abierta"`);
    if (jornadaRec) {
      e.record.set("jornadaId", jornadaRec.get("id"));
    }
  } catch (err) {
    // No hay jornada abierta o la collection todavía no existe (pre-migración).
    // No bloqueamos la creación del pedido por esto.
  }

  // ── Generación de orderNumber y estados iniciales ────────────────
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderNumber = "ORD-" + dateStr + "-" + suffix;

  e.record.set("orderNumber", orderNumber);
  e.record.set("paymentStatus", "Pendiente");
  e.record.set("orderStatus", "Pendiente");
  e.next();
}, "orders");
