/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");

  const existing = collection.fields.getByName("hasMedallions");
  if (existing) {
    if (existing.type === "bool") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("hasMedallions"); // exists with wrong type, remove first
  }

  collection.fields.add(new BoolField({
    name: "hasMedallions",
    required: true
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.fields.removeByName("hasMedallions");
  return app.save(collection);
})
