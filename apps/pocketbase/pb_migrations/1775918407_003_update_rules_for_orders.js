/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.listRule = "customerId = @request.auth.id || customerId = null";
  collection.viewRule = "customerId = @request.auth.id || customerId = null";
  collection.createRule = "";
  collection.updateRule = "@request.auth.role = 'ADMIN'";
  collection.deleteRule = "@request.auth.role = 'ADMIN'";
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.createRule = "";
  collection.listRule = "";
  collection.viewRule = "";
  collection.updateRule = "@request.auth.role = 'ADMIN'";
  collection.deleteRule = "@request.auth.role = 'ADMIN'";
  return app.save(collection);
})
