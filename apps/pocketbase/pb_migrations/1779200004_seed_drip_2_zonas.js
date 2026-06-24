/// <reference path="../pb_data/types.d.ts" />
// Drip Burger: trabaja con SOLO 2 zonas (Centro + Afueras), no usa el modo
// distancia/fijo por default. Esta migration:
//   1) cambia modo_envio a 'zonas' (default de 1779200002 era 'distancia').
//   2) si zonas_delivery está vacía, seedea 2 zonas circulares:
//        - "Centro"  → radio 1.5km, tarifa = precio_envio_centro (o 1500)
//        - "Afueras" → radio 5.0km, tarifa = precio_envio_alejado (o 2500)
//      Usa las tarifas que el admin ya tenía en settings para no romper el
//      pricing histórico. Si no existen, defaults razonables.
// Idempotente: no toca zonas existentes ni el modo si ya está en 'zonas'.
migrate((app) => {
  const s = app.findCollectionByNameOrId("settings");
  if (!s) return;

  // 1) Forzar modo='zonas' (Drip trabaja con zonas, no con distancia)
  try {
    const recs = app.findAllRecords("settings");
    for (const r of recs) {
      if (r.get("modo_envio") !== "zonas") {
        r.set("modo_envio", "zonas");
        app.save(r);
      }
    }
  } catch (e) { /* no-op */ }

  // 2) Seed 2 zonas circulares si la collection está vacía
  let zd = null;
  try { zd = app.findCollectionByNameOrId("zonas_delivery"); } catch (e) {}
  if (!zd) return;

  let existing = [];
  try { existing = app.findAllRecords("zonas_delivery"); } catch (e) {}
  if (existing && existing.length > 0) return; // ya hay zonas, no clobbear

  // Leer tarifas históricas de settings para mantener consistencia con
  // lo que el local cobraba antes. Si no están, usar defaults razonables.
  let tarifaCentro = 1500;
  let tarifaAfueras = 2500;
  try {
    const recs = app.findAllRecords("settings");
    if (recs && recs.length > 0) {
      const r = recs[0];
      const c = Number(r.get("precio_envio_centro"));
      const a = Number(r.get("precio_envio_alejado"));
      if (Number.isFinite(c) && c > 0) tarifaCentro = c;
      if (Number.isFinite(a) && a > 0) tarifaAfueras = a;
    }
  } catch (e) { /* no-op */ }

  const zonas = [
    {
      zona_id: "CENTRO",
      nombre: "Centro",
      color: "#10b981",
      tarifa: tarifaCentro,
      orden: 1,
      activa: true,
      tipo: "circulo",
      radio_km: 1.5,
      coords: [], // sin polígono, es círculo
    },
    {
      zona_id: "AFUERAS",
      nombre: "Afueras",
      color: "#f59e0b",
      tarifa: tarifaAfueras,
      orden: 2,
      activa: true,
      tipo: "circulo",
      radio_km: 5.0,
      coords: [],
    },
  ];

  for (const z of zonas) {
    try {
      const rec = new Record(zd);
      rec.set("zona_id", z.zona_id);
      rec.set("nombre", z.nombre);
      rec.set("color", z.color);
      rec.set("tarifa", z.tarifa);
      rec.set("orden", z.orden);
      rec.set("activa", z.activa);
      rec.set("tipo", z.tipo);
      rec.set("radio_km", z.radio_km);
      rec.set("coords", z.coords);
      app.save(rec);
    } catch (e) {
      console.log("seed zona " + z.zona_id + " falló: " + (e && e.message ? e.message : e));
    }
  }
}, (app) => {
  // Down: borrar las 2 zonas seedeadas (solo si existen).
  try {
    const recs = app.findRecordsByFilter("zonas_delivery", "zona_id = 'CENTRO' || zona_id = 'AFUERAS'", "", 10);
    for (const r of recs) app.delete(r);
  } catch (e) {}
  // No revertimos modo_envio: el admin pudo haberlo cambiado.
});
