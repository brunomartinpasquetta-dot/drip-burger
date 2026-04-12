/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.getByName("doublePrice");
  field.required = false;
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.getByName("doublePrice");
  field.required = false;
  return app.save(collection);
})
