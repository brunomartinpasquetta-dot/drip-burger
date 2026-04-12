/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");

  const existing = collection.fields.getByName("orderStatus");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("orderStatus"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "orderStatus",
    required: true,
    values: ["Pendiente", "En camino", "Finalizado"]
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("orderStatus");
  return app.save(collection);
})
