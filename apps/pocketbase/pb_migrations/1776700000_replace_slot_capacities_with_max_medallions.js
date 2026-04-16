/// <reference path="../pb_data/types.d.ts" />
// Reemplaza el sistema de capacidad por-slot (slotCapacities json) por una
// única capacidad global en medallones (maxMedallionsPerSlot number).
//
// - Agrega el campo maxMedallionsPerSlot (default 20) a settings.
// - Limpia slotCapacities en el registro existente (lo deja vacío para no confundir).
// - El campo slotCapacities se conserva en el schema por compatibilidad hacia
//   atrás con el bundle previo, pero ya no lo consume nadie. Si en el futuro
//   se desea removerlo, basta con una migración adicional.
// Idempotente.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("settings");

  if (!collection.fields.getByName("maxMedallionsPerSlot")) {
    collection.fields.add(new NumberField({
      name: "maxMedallionsPerSlot",
      required: false,
      min: 0,
      max: 500,
    }));
  }

  app.save(collection);

  try {
    const records = app.findRecordsByFilter("settings", `id != ""`, "", 100);
    for (const rec of records) {
      const current = rec.get("maxMedallionsPerSlot");
      if (current == null || Number(current) === 0) {
        rec.set("maxMedallionsPerSlot", 20);
      }
      // Limpiar slotCapacities obsoleto para que no haya dudas sobre cuál es la fuente
      const oldCaps = rec.get("slotCapacities");
      if (oldCaps && typeof oldCaps === "object" && Object.keys(oldCaps).length > 0) {
        rec.set("slotCapacities", {});
      }
      app.save(rec);
    }
  } catch (e) {
    // No hay records todavía, nada que seed
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("settings");
  collection.fields.removeByName("maxMedallionsPerSlot");
  return app.save(collection);
});
