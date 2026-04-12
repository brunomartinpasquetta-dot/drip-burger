/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");

  const existing = collection.fields.getByName("precio_envio_snapshot");
  if (existing) {
    if (existing.type === "number") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("precio_envio_snapshot"); // exists with wrong type, remove first
  }

  collection.fields.add(new NumberField({
    name: "precio_envio_snapshot",
    required: false,
    min: 0
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("precio_envio_snapshot");
  return app.save(collection);
})
