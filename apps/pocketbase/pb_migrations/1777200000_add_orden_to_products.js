/// <reference path="../pb_data/types.d.ts" />
// Agrega campo `orden` (number) a la collection products. Usado para drag&drop
// en /gestion/productos y para ordenar el catálogo del cliente.
// Seed: asigna 10, 20, 30... a los productos existentes en orden ASC por created.
// Idempotente.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");

  if (!collection.fields.getByName("orden")) {
    collection.fields.add(new NumberField({
      name: "orden",
      required: false,
      min: 0,
    }));
  }

  app.save(collection);

  try {
    // Seed: sólo a productos que tengan orden=0/null. Idempotente.
    const records = app.findRecordsByFilter("products", `id != ""`, "+created", 500);
    let i = 1;
    for (const rec of records) {
      const current = Number(rec.get("orden") || 0);
      if (current === 0) {
        rec.set("orden", i * 10);
        app.save(rec);
      }
      i += 1;
    }
  } catch (e) {
    // sin records aún — nada que seedear
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.fields.removeByName("orden");
  return app.save(collection);
});
