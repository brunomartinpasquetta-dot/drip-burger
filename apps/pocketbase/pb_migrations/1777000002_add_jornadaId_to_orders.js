/// <reference path="../pb_data/types.d.ts" />
//
// Agrega jornadaId (relation → jornadas) a la collection `orders`.
// El hook order-confirmation lo setea automáticamente al crear un pedido,
// asociándolo con la jornada abierta en ese momento. Idempotente.
migrate((app) => {
  const jornadasCollection = app.findCollectionByNameOrId("jornadas");
  const collection = app.findCollectionByNameOrId("orders");

  const existing = collection.fields.getByName("jornadaId");
  if (existing && existing.type === "relation") {
    return; // field already exists with correct type, skip
  }
  if (existing) {
    collection.fields.removeByName("jornadaId");
  }

  collection.fields.add(new RelationField({
    name: "jornadaId",
    required: false,
    collectionId: jornadasCollection.id,
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("jornadaId");
  return app.save(collection);
});
