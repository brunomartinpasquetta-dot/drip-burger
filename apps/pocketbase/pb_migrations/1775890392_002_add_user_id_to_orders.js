/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users");
  const collection = app.findCollectionByNameOrId("orders");

  const existing = collection.fields.getByName("user_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("user_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "user_id",
    required: false,
    collectionId: usersCollection.id
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("user_id");
  return app.save(collection);
})
