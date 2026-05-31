/// <reference path="../pb_data/types.d.ts" />
// Fix: el botón de desactivar producto del menú admin tiraba error y no
// desactivaba. Dos causas en la collection products:
//   1) `available` estaba con required:true → PocketBase rechaza `false` en
//      campos boolean required (lo trata como vacío). Por eso podía activar
//      pero NUNCA desactivar.
//   2) listRule/viewRule eran `available = true` → aunque el update pasara,
//      PB filtra al admin el registro recién desactivado y el frontend tira
//      error al no poder leerlo de vuelta. Además el producto desaparece
//      del panel de admin (no se puede reactivar).
// Mismo bug que fixeamos en Sinatra (ver migration 1780014014_updated_products.js).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");

  // Rules: clientes siguen viendo solo disponibles; el admin ve todo.
  collection.listRule = "available = true || @request.auth.role = \"ADMIN\"";
  collection.viewRule = "available = true || @request.auth.role = \"ADMIN\"";

  // available: required false para que `false` no falle como "vacío".
  const field = collection.fields.getByName("available");
  field.required = false;

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.listRule = "available = true";
  collection.viewRule = "available = true";
  const field = collection.fields.getByName("available");
  field.required = true;
  return app.save(collection);
});
