/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");

  const existing = collection.fields.getByName("doublePrice");
  if (existing) {
    if (existing.type === "number") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("doublePrice"); // exists with wrong type, remove first
  }

  collection.fields.add(new NumberField({
    name: "doublePrice",
    required: false,
    min: 0.01
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.fields.removeByName("doublePrice");
  return app.save(collection);
})
