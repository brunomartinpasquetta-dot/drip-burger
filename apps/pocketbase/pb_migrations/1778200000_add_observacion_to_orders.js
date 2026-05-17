/// <reference path="../pb_data/types.d.ts" />
//
// Campo `observacion` en orders, max 50 chars. Cliente lo escribe en checkout
// (1 línea, optional). Admin ve badge en card + modal con texto. Cocina lo ve
// inline + ticket lo imprime con "Obs: ...". Idempotente, aditivo.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  if (!collection.fields.getByName("observacion")) {
    collection.fields.add(new TextField({ name: "observacion", required: false, max: 50 }));
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("observacion");
  return app.save(collection);
});
