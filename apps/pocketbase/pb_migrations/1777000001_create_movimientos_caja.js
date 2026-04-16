/// <reference path="../pb_data/types.d.ts" />
//
// Collection `movimientos_caja`: ingresos y egresos manuales de efectivo
// durante una jornada. Idempotente.
migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users");
  const jornadasCollection = app.findCollectionByNameOrId("jornadas");

  let collection;
  try {
    collection = app.findCollectionByNameOrId("movimientos_caja");
  } catch (e) {
    collection = null;
  }

  if (!collection) {
    collection = new Collection({ name: "movimientos_caja", type: "base" });
    app.save(collection);
    collection = app.findCollectionByNameOrId("movimientos_caja");
  }

  const ensureField = (name, factory) => {
    if (!collection.fields.getByName(name)) {
      collection.fields.add(factory());
    }
  };

  ensureField("jornadaId", () => new RelationField({
    name: "jornadaId",
    required: true,
    collectionId: jornadasCollection.id,
  }));
  ensureField("tipo", () => new SelectField({
    name: "tipo",
    required: true,
    maxSelect: 1,
    values: ["ingreso", "egreso"],
  }));
  ensureField("monto", () => new NumberField({ name: "monto", required: true, min: 0.01 }));
  ensureField("motivo", () => new TextField({ name: "motivo", required: true, max: 500 }));
  ensureField("adminId", () => new RelationField({
    name: "adminId",
    required: false,
    collectionId: usersCollection.id,
  }));

  collection.listRule = "@request.auth.role = 'ADMIN'";
  collection.viewRule = "@request.auth.role = 'ADMIN'";
  collection.createRule = "@request.auth.role = 'ADMIN'";
  collection.updateRule = "@request.auth.role = 'ADMIN'";
  collection.deleteRule = "@request.auth.role = 'ADMIN'";

  app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("movimientos_caja");
    return app.delete(collection);
  } catch (e) {
    return;
  }
});
