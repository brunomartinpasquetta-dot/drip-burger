/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");

  collection.fields.removeByName("orderStatus");

  collection.fields.add(new SelectField({
    name: "orderStatus",
    required: true,
    maxSelect: 1,
    values: ["Pendiente", "En preparación", "Listo", "En camino", "Finalizado"]
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");

  collection.fields.removeByName("orderStatus");

  collection.fields.add(new SelectField({
    name: "orderStatus",
    required: true,
    maxSelect: 1,
    values: ["Pendiente", "En preparación", "En camino", "Finalizado"]
  }));

  return app.save(collection);
});
