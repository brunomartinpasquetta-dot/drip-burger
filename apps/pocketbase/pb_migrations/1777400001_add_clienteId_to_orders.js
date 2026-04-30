/// <reference path="../pb_data/types.d.ts" />
// Agrega `clienteId` (relation → clientes) a orders. Optional para no romper
// guest checkout. Idempotente.
migrate((app) => {
  const orders = app.findCollectionByNameOrId("orders");
  let clientes = null;
  try { clientes = app.findCollectionByNameOrId("clientes"); } catch (e) { clientes = null; }
  if (!clientes) return; // Sin clientes no podemos crear la relation

  if (!orders.fields.getByName("clienteId")) {
    orders.fields.add(new RelationField({
      name: "clienteId",
      required: false,
      maxSelect: 1,
      collectionId: clientes.id,
    }));
  }

  app.save(orders);
}, (app) => {
  const orders = app.findCollectionByNameOrId("orders");
  orders.fields.removeByName("clienteId");
  return app.save(orders);
});
