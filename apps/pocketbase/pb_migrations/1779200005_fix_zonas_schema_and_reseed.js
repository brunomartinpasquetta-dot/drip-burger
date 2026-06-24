/// <reference path="../pb_data/types.d.ts" />
// Fix: la collection zonas_delivery se creó incompleta (faltaron campos
// zona_id, nombre, color, tarifa, orden, activa, coords + rules).
// Causa: 1779200000 detectó la collection existente de un intento
// previo y retornó early sin agregar los fields.
// Este migration:
//   1) Agrega los fields faltantes (idempotente: solo si no existen).
//   2) Setea listRule/viewRule a "" (público).
//   3) Re-seedea las 2 zonas Drip (Centro/Afueras) si la collection
//      está vacía o si los records actuales no tienen zona_id seteado.
migrate((app) => {
  const zd = app.findCollectionByNameOrId("zonas_delivery");
  if (!zd) return;

  if (!zd.fields.getByName("zona_id")) {
    zd.fields.add(new Field({ name: "zona_id", type: "text", required: true, max: 16 }));
  }
  if (!zd.fields.getByName("nombre")) {
    zd.fields.add(new Field({ name: "nombre", type: "text", required: true, max: 60 }));
  }
  if (!zd.fields.getByName("color")) {
    zd.fields.add(new Field({ name: "color", type: "text", required: true, max: 16 }));
  }
  if (!zd.fields.getByName("tarifa")) {
    zd.fields.add(new Field({ name: "tarifa", type: "number", required: false, min: 0 }));
  }
  if (!zd.fields.getByName("orden")) {
    zd.fields.add(new Field({ name: "orden", type: "number", required: false, min: 0 }));
  }
  if (!zd.fields.getByName("activa")) {
    zd.fields.add(new Field({ name: "activa", type: "bool", required: false }));
  }
  if (!zd.fields.getByName("coords")) {
    zd.fields.add(new Field({ name: "coords", type: "json", required: false }));
  }

  // Rules público para read (cliente del e-commerce los necesita para
  // el zonificador). Admin para write.
  zd.listRule = "";
  zd.viewRule = "";
  if (!zd.createRule) zd.createRule = "@request.auth.role = \"ADMIN\"";
  if (!zd.updateRule) zd.updateRule = "@request.auth.role = \"ADMIN\"";
  if (!zd.deleteRule) zd.deleteRule = "@request.auth.role = \"ADMIN\"";

  app.save(zd);

  // Limpiar records previos rotos (los que NO tienen zona_id seteado).
  // Esto solo afecta a registros que quedaron sin nombre/tarifa de los
  // intentos previos del seed — no toca zonas reales que el admin ya
  // haya configurado.
  try {
    const allRecs = app.findAllRecords("zonas_delivery");
    for (const r of allRecs) {
      const zid = r.get("zona_id");
      if (!zid || String(zid).trim() === "") {
        try { app.delete(r); } catch (e) {}
      }
    }
  } catch (e) { /* no-op */ }

  // Re-seed 2 zonas si quedó vacía después de la limpieza.
  let remaining = [];
  try { remaining = app.findAllRecords("zonas_delivery"); } catch (e) {}
  if (remaining.length > 0) return;

  // Tarifas históricas de settings (precio_envio_centro/alejado) si existen.
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
    { zona_id: "CENTRO", nombre: "Centro", color: "#10b981", tarifa: tarifaCentro, orden: 1, activa: true, tipo: "circulo", radio_km: 1.5, coords: [] },
    { zona_id: "AFUERAS", nombre: "Afueras", color: "#f59e0b", tarifa: tarifaAfueras, orden: 2, activa: true, tipo: "circulo", radio_km: 5.0, coords: [] },
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

      // Validar post-save — PB silently drops fields desconocidos.
      const verify = app.findRecordById("zonas_delivery", rec.id);
      const missing = [];
      if (!verify.get("zona_id")) missing.push("zona_id");
      if (!verify.get("nombre")) missing.push("nombre");
      if (!verify.get("color")) missing.push("color");
      if (verify.get("tarifa") == null) missing.push("tarifa");
      if (missing.length > 0) {
        console.log("WARN seed " + z.zona_id + " missing fields: " + missing.join(","));
      } else {
        console.log("seeded zona " + z.zona_id + " ok");
      }
    } catch (e) {
      console.log("seed zona " + z.zona_id + " falló: " + (e && e.message ? e.message : e));
    }
  }
}, (app) => {
  // Down: borrar las 2 zonas seedeadas.
  try {
    const recs = app.findRecordsByFilter("zonas_delivery", "zona_id = 'CENTRO' || zona_id = 'AFUERAS'", "", 10);
    for (const r of recs) app.delete(r);
  } catch (e) {}
});
