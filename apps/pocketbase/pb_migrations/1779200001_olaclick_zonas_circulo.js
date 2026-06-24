/// <reference path="../pb_data/types.d.ts" />
// Portado de Sinatra (Fase F OlaClick): agregar campos `tipo` (poligono|
// circulo) y `radio_km` a zonas_delivery, y `local_lat`/`local_lng` a
// settings. Hace coords no-required (las zonas circulo no usan coords).
// Idempotente.
migrate((app) => {
  // 1) zonas_delivery: tipo, radio_km, coords no-required
  const zd = app.findCollectionByNameOrId("zonas_delivery");
  if (zd) {
    if (!zd.fields.getByName("tipo")) {
      zd.fields.add(new Field({
        name: "tipo", type: "select", required: false, maxSelect: 1,
        values: ["poligono", "circulo"],
      }));
    }
    if (!zd.fields.getByName("radio_km")) {
      zd.fields.add(new Field({
        name: "radio_km", type: "number", required: false, min: 0,
      }));
    }
    const coords = zd.fields.getByName("coords");
    if (coords) coords.required = false;
    app.save(zd);
  }
  // 2) settings: local_lat, local_lng
  const s = app.findCollectionByNameOrId("settings");
  if (s) {
    if (!s.fields.getByName("local_lat")) {
      s.fields.add(new Field({ name: "local_lat", type: "number", required: false }));
    }
    if (!s.fields.getByName("local_lng")) {
      s.fields.add(new Field({ name: "local_lng", type: "number", required: false }));
    }
    app.save(s);

    // Setear coords del local Drip por default si no están seteadas.
    // Juan de Garay 2189, Coronda, Santa Fe.
    try {
      const recs = app.findAllRecords("settings");
      for (const r of recs) {
        let dirty = false;
        if (r.get("local_lat") == null || r.get("local_lat") === 0) {
          r.set("local_lat", -31.9731); dirty = true;
        }
        if (r.get("local_lng") == null || r.get("local_lng") === 0) {
          r.set("local_lng", -60.9205); dirty = true;
        }
        if (dirty) app.save(r);
      }
    } catch (e) { /* no-op */ }
  }
}, (app) => {
  const zd = app.findCollectionByNameOrId("zonas_delivery");
  if (zd) {
    const t = zd.fields.getByName("tipo"); if (t) zd.fields.removeById(t.id);
    const rk = zd.fields.getByName("radio_km"); if (rk) zd.fields.removeById(rk.id);
    app.save(zd);
  }
  const s = app.findCollectionByNameOrId("settings");
  if (s) {
    const ll = s.fields.getByName("local_lat"); if (ll) s.fields.removeById(ll.id);
    const lg = s.fields.getByName("local_lng"); if (lg) s.fields.removeById(lg.id);
    app.save(s);
  }
});
