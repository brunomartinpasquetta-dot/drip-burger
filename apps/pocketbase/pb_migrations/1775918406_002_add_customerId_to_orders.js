/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users");
  const collection = app.findCollectionByNameOrId("orders");

  const existing = collection.fields.getByName("customerId");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("customerId"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "customerId",
    required: false,
    collectionId: usersCollection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("customerId");
  return app.save(collection);
})
