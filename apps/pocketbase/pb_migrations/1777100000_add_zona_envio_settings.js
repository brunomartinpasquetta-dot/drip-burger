/// <reference path="../pb_data/types.d.ts" />
// Agrega precio_envio_centro y precio_envio_alejado a settings.
// Mantiene precio_envio legacy por compatibilidad. Idempotente.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("settings");

  if (!collection.fields.getByName("precio_envio_centro")) {
    collection.fields.add(new NumberField({
      name: "precio_envio_centro",
      required: false,
      min: 0,
    }));
  }
  if (!collection.fields.getByName("precio_envio_alejado")) {
    collection.fields.add(new NumberField({
      name: "precio_envio_alejado",
      required: false,
      min: 0,
    }));
  }

  app.save(collection);

  // Seed: si centro está en 0 y hay precio_envio legacy > 0, copiarlo.
  // alejado queda en 0 por default (admin lo configura explícito).
  try {
    const records = app.findRecordsByFilter("settings", `id != ""`, "", 100);
    for (const rec of records) {
      const legacy = Number(rec.get("precio_envio") || 0);
      const centroActual = Number(rec.get("precio_envio_centro") || 0);
      if (centroActual === 0 && legacy > 0) {
        rec.set("precio_envio_centro", legacy);
        app.save(rec);
      }
    }
  } catch (e) {
    // sin records todavía
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("settings");
  collection.fields.removeByName("precio_envio_centro");
  collection.fields.removeByName("precio_envio_alejado");
  return app.save(collection);
});
