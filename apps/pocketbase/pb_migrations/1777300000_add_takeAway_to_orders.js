/// <reference path="../pb_data/types.d.ts" />
// Agrega campo `takeAway` (boolean) a la collection orders. Pedidos con
// takeAway=true no requieren dirección de envío ni cobran shipping; el
// cliente retira en el local. Default false. Idempotente.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");

  if (!collection.fields.getByName("takeAway")) {
    collection.fields.add(new BoolField({
      name: "takeAway",
      required: false,
    }));
  }

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("takeAway");
  return app.save(collection);
});
