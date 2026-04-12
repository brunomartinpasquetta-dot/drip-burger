/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");

  const existing = collection.fields.getByName("fixedPrice");
  if (existing) {
    if (existing.type === "number") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("fixedPrice"); // exists with wrong type, remove first
  }

  collection.fields.add(new NumberField({
    name: "fixedPrice",
    required: false,
    min: 0.01
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.fields.removeByName("fixedPrice");
  return app.save(collection);
})
