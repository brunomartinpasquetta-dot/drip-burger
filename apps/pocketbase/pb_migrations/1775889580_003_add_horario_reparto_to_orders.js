/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");

  const existing = collection.fields.getByName("horario_reparto");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("horario_reparto"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "horario_reparto",
    required: true,
    values: ["20:30", "21:00", "21:30", "22:00", "22:30", "23:00"]
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("horario_reparto");
  return app.save(collection);
})
