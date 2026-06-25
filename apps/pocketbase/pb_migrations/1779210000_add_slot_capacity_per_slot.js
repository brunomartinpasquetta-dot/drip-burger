/// <reference path="../pb_data/types.d.ts" />
// Cliente quiere setear cap de medallones POR TURNO (no global). Agregamos
// un field JSON slotCapacityPerSlot a settings con shape:
//   { "20:30": 24, "21:00": 30, "21:30": 30, "22:00": 30, "22:30": 24, "23:00": 18 }
// La API /slots/availability y el hook PB order-confirmation leen este
// JSON. Si falta el slot o el field, caen al `maxMedallionsPerSlot` global
// (compat 100% con la config anterior).
//
// Seed inicial: copia el maxMedallionsPerSlot global a cada uno de los 6
// slots, así nada cambia de comportamiento hasta que el admin edite valores
// específicos desde /gestion/config.
migrate((app) => {
  const s = app.findCollectionByNameOrId("settings");
  if (!s) return;
  if (!s.fields.getByName("slotCapacityPerSlot")) {
    s.fields.add(new Field({ name: "slotCapacityPerSlot", type: "json", required: false }));
  }
  app.save(s);

  try {
    const recs = app.findAllRecords("settings");
    for (const r of recs) {
      const existing = r.get("slotCapacityPerSlot");
      if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) continue;
      const global = Number(r.get("maxMedallionsPerSlot")) || 20;
      r.set("slotCapacityPerSlot", {
        "20:30": global,
        "21:00": global,
        "21:30": global,
        "22:00": global,
        "22:30": global,
        "23:00": global,
      });
      app.save(r);
    }
  } catch (e) { /* no-op */ }
}, (app) => {
  const s = app.findCollectionByNameOrId("settings");
  if (!s) return;
  const f = s.fields.getByName("slotCapacityPerSlot");
  if (f) s.fields.removeById(f.id);
  app.save(s);
});
