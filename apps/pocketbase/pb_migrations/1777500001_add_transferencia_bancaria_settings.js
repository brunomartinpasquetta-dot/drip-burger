/// <reference path="../pb_data/types.d.ts" />
// Agrega 3 campos a settings para los datos de transferencia bancaria que
// se le muestran al cliente cuando elige "Transferencia bancaria" como
// forma de pago. Idempotente.
//
// Validación de formato (CBU 22 dígitos, alias min 6 alfanum) se hace en
// frontend al guardar desde /gestion/config — el schema permite cualquier
// string para no bloquear ediciones parciales.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("settings");

  if (!collection.fields.getByName("transferencia_titular")) {
    collection.fields.add(new TextField({
      name: "transferencia_titular",
      required: false,
      max: 200,
    }));
  }
  if (!collection.fields.getByName("transferencia_alias")) {
    collection.fields.add(new TextField({
      name: "transferencia_alias",
      required: false,
      max: 64,
    }));
  }
  if (!collection.fields.getByName("transferencia_cbu")) {
    collection.fields.add(new TextField({
      name: "transferencia_cbu",
      required: false,
      max: 22,
    }));
  }

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("settings");
  collection.fields.removeByName("transferencia_titular");
  collection.fields.removeByName("transferencia_alias");
  collection.fields.removeByName("transferencia_cbu");
  return app.save(collection);
});
