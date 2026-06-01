/// <reference path="../pb_data/types.d.ts" />
// Fix: el listado en /gestion seguía dando 400 ("Something went wrong")
// con la rule basada en role. Causa: si el browser está autenticado con
// un token de la collection `clientes` (no tiene campo `role`), PB intenta
// evaluar @request.auth.role contra un record que no lo tiene y lanza
// error genérico 400 — incluso aunque la OR con id matchee.
//
// Solución: usar `@request.auth.collectionName` que es un campo de sistema
// presente en TODOS los auth records, independiente de la collection.
// Convención del proyecto: `users` = staff/admin. `clientes` = cliente final.
// Por eso "cualquier auth desde users" implica acceso de staff.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("clientes");
  collection.listRule = "@request.auth.id = id || @request.auth.collectionName = \"users\"";
  collection.viewRule = "@request.auth.id = id || @request.auth.collectionName = \"users\"";
  collection.updateRule = "@request.auth.id = id || @request.auth.collectionName = \"users\"";
  collection.deleteRule = "@request.auth.collectionName = \"users\"";
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("clientes");
  collection.listRule = "@request.auth.id = id || @request.auth.role = \"ADMIN\"";
  collection.viewRule = "@request.auth.id = id || @request.auth.role = \"ADMIN\"";
  collection.updateRule = "@request.auth.id = id || @request.auth.role = \"ADMIN\"";
  collection.deleteRule = "@request.auth.role = \"ADMIN\"";
  return app.save(collection);
});
