/// <reference path="../pb_data/types.d.ts" />
//
// Renombra valores legacy de orderStatus para unificar UI:
//   "En camino"   → "Enviado"
//   "Finalizado"  → "Entregado"
// Idempotente: corre cada vez que se aplica pero sólo update si encuentra valores viejos.
migrate((app) => {
  const renameMap = [
    { from: "En camino", to: "Enviado" },
    { from: "Finalizado", to: "Entregado" },
  ];
  for (const { from, to } of renameMap) {
    try {
      const records = app.findRecordsByFilter("orders", `orderStatus = "${from}"`, "", 1000);
      for (const r of records) {
        r.set("orderStatus", to);
        app.save(r);
      }
    } catch (e) {
      // sin matches o collection vacía
    }
  }
}, (app) => {
  // Down: revertir si hace falta. No es crítico — los valores nuevos también
  // funcionan con la app vieja porque el campo es TextField.
  const revertMap = [
    { from: "Enviado", to: "En camino" },
    { from: "Entregado", to: "Finalizado" },
  ];
  for (const { from, to } of revertMap) {
    try {
      const records = app.findRecordsByFilter("orders", `orderStatus = "${from}"`, "", 1000);
      for (const r of records) {
        r.set("orderStatus", to);
        app.save(r);
      }
    } catch (e) { /* noop */ }
  }
});
