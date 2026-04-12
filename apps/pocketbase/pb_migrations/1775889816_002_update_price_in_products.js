/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.getByName("price");
  field.required = false;
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.getByName("price");
  field.required = true;
  return app.save(collection);
})
