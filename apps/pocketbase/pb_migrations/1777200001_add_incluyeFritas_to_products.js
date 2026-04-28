/// <reference path="../pb_data/types.d.ts" />
// Agrega campo `incluyeFritas` (boolean) a products. Las hamburguesas vienen
// con papas; productos sin medallones (ej: nuggets) NO. Default true.
//
// Seed para productos existentes:
//   - hasMedallions === true  → incluyeFritas = true
//   - hasMedallions === false → incluyeFritas = false
// Idempotente.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");

  if (!collection.fields.getByName("incluyeFritas")) {
    collection.fields.add(new BoolField({
      name: "incluyeFritas",
      required: false,
    }));
  }

  app.save(collection);

  try {
    const records = app.findRecordsByFilter("products", `id != ""`, "", 500);
    for (const rec of records) {
      // Sólo seedear si el campo todavía está en su default (vacío/null/false implícito)
      // y no ha sido explícitamente seteado por el admin.
      const hasMed = !!rec.get("hasMedallions");
      const current = rec.get("incluyeFritas");
      if (current === null || current === undefined || current === "" || current === false) {
        rec.set("incluyeFritas", hasMed);
        app.save(rec);
      }
    }
  } catch (e) {
    // sin records aún
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.fields.removeByName("incluyeFritas");
  return app.save(collection);
});
