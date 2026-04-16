/// <reference path="../pb_data/types.d.ts" />
//
// Collection `jornadas`: una fila por cada apertura/cierre de caja.
// Una sola jornada puede estar en estado "abierta" a la vez (enforced en app).
// Idempotente: crea la collection solo si no existe, agrega fields faltantes,
// aplica rules.
migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users");

  let collection;
  try {
    collection = app.findCollectionByNameOrId("jornadas");
  } catch (e) {
    collection = null;
  }

  if (!collection) {
    collection = new Collection({ name: "jornadas", type: "base" });
    app.save(collection);
    collection = app.findCollectionByNameOrId("jornadas");
  }

  const ensureField = (name, factory) => {
    if (!collection.fields.getByName(name)) {
      collection.fields.add(factory());
    }
  };

  ensureField("fecha", () => new DateField({ name: "fecha", required: true }));
  ensureField("horaApertura", () => new TextField({ name: "horaApertura", required: true, max: 8 }));
  ensureField("horaCierre", () => new TextField({ name: "horaCierre", required: false, max: 8 }));
  ensureField("montoInicial", () => new NumberField({ name: "montoInicial", required: true, min: 0 }));
  ensureField("montoCierre", () => new NumberField({ name: "montoCierre", required: false }));
  ensureField("totalEfectivo", () => new NumberField({ name: "totalEfectivo", required: false }));
  ensureField("totalTransferencias", () => new NumberField({ name: "totalTransferencias", required: false }));
  ensureField("totalPedidos", () => new NumberField({ name: "totalPedidos", required: false }));
  ensureField("pedidosCancelados", () => new NumberField({ name: "pedidosCancelados", required: false }));
  ensureField("montoCancelados", () => new NumberField({ name: "montoCancelados", required: false }));
  ensureField("efectivoEsperado", () => new NumberField({ name: "efectivoEsperado", required: false }));
  ensureField("cuadre", () => new NumberField({ name: "cuadre", required: false }));
  ensureField("estado", () => new SelectField({
    name: "estado",
    required: true,
    maxSelect: 1,
    values: ["abierta", "cerrada"],
  }));
  ensureField("adminId", () => new RelationField({
    name: "adminId",
    required: false,
    collectionId: usersCollection.id,
  }));

  // Rules: solo ADMIN
  collection.listRule = "@request.auth.role = 'ADMIN'";
  collection.viewRule = "@request.auth.role = 'ADMIN'";
  collection.createRule = "@request.auth.role = 'ADMIN'";
  collection.updateRule = "@request.auth.role = 'ADMIN'";
  collection.deleteRule = "@request.auth.role = 'ADMIN'";

  app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("jornadas");
    return app.delete(collection);
  } catch (e) {
    return;
  }
});
