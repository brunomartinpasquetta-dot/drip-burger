/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");

  const existing = collection.fields.getByName("forma_pago");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("forma_pago"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "forma_pago",
    required: true,
    values: ["Efectivo", "Transferencia"]
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("forma_pago");
  return app.save(collection);
})
