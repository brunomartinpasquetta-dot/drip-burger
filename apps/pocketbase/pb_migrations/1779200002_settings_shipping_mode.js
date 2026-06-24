/// <reference path="../pb_data/types.d.ts" />
// Portado de Sinatra (Fase F2 OlaClick) — modo de cálculo de envío
// configurable en settings.
//
// Tres modos disponibles (el admin elige uno en /gestion → Zonas):
//   - 'zonas'      -> usa las features de zonas_delivery (círculo o polígono)
//                     según lo que esté cargado.
//   - 'distancia'  -> precio_envío = envio_base + km × envio_por_km, con
//                     cutoff envio_max_km. Mismo cálculo que OlaClick
//                     ("Distancia recorrida").
//   - 'fijo'       -> mismo precio para todos los pedidos (envio_base).
//                     Sin cutoff.
// Default para drip: 'distancia' base=1500 porKm=300 maxKm=15. Cubre todo
// Coronda + rural cercano sin requerir config del admin el día del deploy.
// El cliente del local lo cambia desde /gestion → Zonas cuando quiera.
migrate((app) => {
  const s = app.findCollectionByNameOrId("settings");
  if (!s) return;

  if (!s.fields.getByName("modo_envio")) {
    s.fields.add(new Field({
      name: "modo_envio",
      type: "select",
      required: false,
      maxSelect: 1,
      values: ["zonas", "distancia", "fijo"],
    }));
  }
  if (!s.fields.getByName("envio_base")) {
    s.fields.add(new Field({ name: "envio_base", type: "number", required: false, min: 0 }));
  }
  if (!s.fields.getByName("envio_por_km")) {
    s.fields.add(new Field({ name: "envio_por_km", type: "number", required: false, min: 0 }));
  }
  if (!s.fields.getByName("envio_max_km")) {
    s.fields.add(new Field({ name: "envio_max_km", type: "number", required: false, min: 0 }));
  }
  app.save(s);

  // Setear defaults razonables en el primer settings record (no clobbear si
  // ya hay valores no-default).
  try {
    const recs = app.findAllRecords("settings");
    for (const r of recs) {
      let dirty = false;
      if (!r.get("modo_envio")) { r.set("modo_envio", "distancia"); dirty = true; }
      if (r.get("envio_base") == null || r.get("envio_base") === 0) { r.set("envio_base", 1500); dirty = true; }
      if (r.get("envio_por_km") == null || r.get("envio_por_km") === 0) { r.set("envio_por_km", 300); dirty = true; }
      if (r.get("envio_max_km") == null || r.get("envio_max_km") === 0) { r.set("envio_max_km", 15); dirty = true; }
      if (dirty) app.save(r);
    }
  } catch (e) {
    // no-op; se setea desde admin si falla acá
  }
}, (app) => {
  const s = app.findCollectionByNameOrId("settings");
  if (!s) return;
  for (const name of ["modo_envio", "envio_base", "envio_por_km", "envio_max_km"]) {
    const f = s.fields.getByName(name);
    if (f) s.fields.removeById(f.id);
  }
  app.save(s);
});
