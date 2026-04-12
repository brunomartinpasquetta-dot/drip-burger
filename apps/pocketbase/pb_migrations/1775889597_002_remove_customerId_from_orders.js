/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("customerId");
  return app.save(collection);
}, (app) => {

  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.add(new TextField({
    name: "customerId",
    required: true,
    min: 0,
    max: 0
  }));
  return app.save(collection);
})
