/// <reference path="../pb_data/types.d.ts" />
//
// FIX CRÍTICO: cerrar las collection rules de `orders` que estaban públicas.
// Antes de esta migración `curl /api/collections/orders/records` devolvía
// HTTP 200 con todos los pedidos (incluyendo customerName, customerPhone,
// customerAddress), exponiendo PII de clientes sin autenticación.
//
// Rules después de esta migración:
// - listRule:   solo admin, o el user dueño del pedido
// - viewRule:   solo admin, o el user dueño del pedido
// - createRule: público (el checkout anónimo debe seguir funcionando)
// - updateRule: solo admin (el flujo de estados desde /gestion)
// - deleteRule: solo admin
//
// Idempotente: solo actualiza la collection si alguna de las rules difiere
// del valor objetivo. No revienta si ya fue corrida.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");

  const target = {
    listRule:   '@request.auth.id != "" && (@request.auth.role = "ADMIN" || user_id = @request.auth.id)',
    viewRule:   '@request.auth.id != "" && (@request.auth.role = "ADMIN" || user_id = @request.auth.id)',
    createRule: '',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
  };

  let dirty = false;
  if (collection.listRule !== target.listRule)     { collection.listRule = target.listRule; dirty = true; }
  if (collection.viewRule !== target.viewRule)     { collection.viewRule = target.viewRule; dirty = true; }
  if (collection.createRule !== target.createRule) { collection.createRule = target.createRule; dirty = true; }
  if (collection.updateRule !== target.updateRule) { collection.updateRule = target.updateRule; dirty = true; }
  if (collection.deleteRule !== target.deleteRule) { collection.deleteRule = target.deleteRule; dirty = true; }

  if (dirty) {
    app.save(collection);
  }
}, (app) => {
  // Rollback: volver a público (estado previo, inseguro pero funcional).
  const collection = app.findCollectionByNameOrId("orders");
  collection.listRule = null;
  collection.viewRule = null;
  collection.createRule = null;
  collection.updateRule = null;
  collection.deleteRule = null;
  app.save(collection);
});
