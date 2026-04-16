/// <reference path="../pb_data/types.d.ts" />
// Agrega slotCapacities (json) a la collection settings para controlar
// la capacidad máxima de pedidos por tanda de entrega. Idempotente.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("settings");

  if (!collection.fields.getByName("slotCapacities")) {
    collection.fields.add(new JSONField({
      name: "slotCapacities",
      required: false,
      maxSize: 100000,
    }));
  }

  app.save(collection);

  // Defaults: 10 pedidos por tanda
  const defaults = {
    "20:30": 10,
    "21:00": 10,
    "21:30": 10,
    "22:00": 10,
    "22:30": 10,
    "23:00": 10,
  };

  try {
    // Filter "id != \"\"" matchea todos los records (el campo id nunca es vacío)
    const records = app.findRecordsByFilter("settings", `id != ""`, "", 100);
    for (const rec of records) {
      const current = rec.get("slotCapacities");
      const isEmpty = !current || (typeof current === "object" && Object.keys(current).length === 0);
      if (isEmpty) {
        rec.set("slotCapacities", defaults);
        app.save(rec);
      }
    }
  } catch (e) {
    // No hay records todavía, nada que seed
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("settings");
  collection.fields.removeByName("slotCapacities");
  return app.save(collection);
});
