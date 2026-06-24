/// <reference path="../pb_data/types.d.ts" />
// Portado de Sinatra (Fase C OlaClick): collection zonas_delivery para editar
// las zonas en runtime desde el admin. Idempotente: si ya existe la
// collection no hace nada.
//
// Fields:
//   zona_id  text  id corto tipo Z1/Z2 (display + matching con orders)
//   nombre   text  Centro / Norte / Sur / etc
//   color    text  hex (#ef4444)
//   tarifa   number ARS
//   orden    number para sort UI
//   activa   bool  permite ocultar sin borrar
//   coords   json  array de [lng, lat] del polígono
migrate((app) => {
  let existing = null;
  try { existing = app.findCollectionByNameOrId("zonas_delivery"); } catch (e) {}
  if (existing) return;

  const collection = new Collection({
    type: "base",
    name: "zonas_delivery",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.role = \"ADMIN\"",
    updateRule: "@request.auth.role = \"ADMIN\"",
    deleteRule: "@request.auth.role = \"ADMIN\"",
    fields: [
      new Field({ name: "zona_id", type: "text", required: true, max: 16 }),
      new Field({ name: "nombre", type: "text", required: true, max: 60 }),
      new Field({ name: "color", type: "text", required: true, max: 16 }),
      new Field({ name: "tarifa", type: "number", required: false, min: 0 }),
      new Field({ name: "orden", type: "number", required: false, min: 0 }),
      new Field({ name: "activa", type: "bool", required: false }),
      new Field({ name: "coords", type: "json", required: true }),
    ],
  });
  return app.save(collection);
}, (app) => {
  let existing = null;
  try { existing = app.findCollectionByNameOrId("zonas_delivery"); } catch (e) {}
  if (existing) return app.delete(existing);
});
