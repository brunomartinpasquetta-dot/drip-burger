/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("settings");

  if (!collection.fields.getByName("hora_apertura")) {
    collection.fields.add(new TextField({
      name: "hora_apertura",
      required: false,
      max: 5,
      min: 0,
      pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
    }));
  }

  if (!collection.fields.getByName("hora_cierre")) {
    collection.fields.add(new TextField({
      name: "hora_cierre",
      required: false,
      max: 5,
      min: 0,
      pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
    }));
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("settings");
  collection.fields.removeByName("hora_apertura");
  collection.fields.removeByName("hora_cierre");
  return app.save(collection);
});
