/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");

  const existing = collection.fields.getByName("triplePrice");
  if (existing) {
    if (existing.type === "number") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("triplePrice"); // exists with wrong type, remove first
  }

  collection.fields.add(new NumberField({
    name: "triplePrice",
    required: false,
    min: 0.01
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.fields.removeByName("triplePrice");
  return app.save(collection);
})
