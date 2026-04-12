/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("settings");
  const field = collection.fields.getByName("precio_envio");
  field.required = false;
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("settings");
  const field = collection.fields.getByName("precio_envio");
  field.required = true;
  return app.save(collection);
})
