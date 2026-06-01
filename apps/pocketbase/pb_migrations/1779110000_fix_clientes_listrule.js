/// <reference path="../pb_data/types.d.ts" />
// Fix: el listado de clientes en /gestion daba 400 con
// "Something went wrong while processing your request" y data:{}.
// Causa: la rule original usaba `@request.auth.collectionName = 'users'`,
// que la versión actual de PocketBase no resuelve cuando se evalúa
// (los clientes loggeados quedan con un auth distinto y la rule falla
// silenciosamente devolviendo 400 genérico).
//
// Sustituimos por un check basado en el campo `role` (que sí existe
// en `users`) y mantenemos `@request.auth.id = id` para que cada
// cliente vea/edite su propio registro.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("clientes");
  collection.listRule = "@request.auth.id = id || @request.auth.role = \"ADMIN\"";
  collection.viewRule = "@request.auth.id = id || @request.auth.role = \"ADMIN\"";
  collection.updateRule = "@request.auth.id = id || @request.auth.role = \"ADMIN\"";
  collection.deleteRule = "@request.auth.role = \"ADMIN\"";
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("clientes");
  collection.listRule = "@request.auth.collectionName = 'users' || @request.auth.id = id";
  collection.viewRule = "@request.auth.collectionName = 'users' || @request.auth.id = id";
  collection.updateRule = "@request.auth.id = id || @request.auth.collectionName = 'users'";
  collection.deleteRule = "@request.auth.collectionName = 'users'";
  return app.save(collection);
});
