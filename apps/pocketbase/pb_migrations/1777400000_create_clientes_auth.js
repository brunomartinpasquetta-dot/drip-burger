/// <reference path="../pb_data/types.d.ts" />
//
// Crea la collection auth `clientes` separada de `users`.
// Convención: `users` = staff / admin / superusers. `clientes` = clientes
// finales del e-commerce (registro público, login en el checkout).
// Idempotente.
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("clientes");
  } catch (e) {
    collection = null;
  }

  if (!collection) {
    collection = new Collection({
      name: "clientes",
      type: "auth",
    });
    app.save(collection);
    collection = app.findCollectionByNameOrId("clientes");
  }

  const ensureField = (name, factory) => {
    if (!collection.fields.getByName(name)) {
      collection.fields.add(factory());
    }
  };

  ensureField("nombre_apellido", () => new TextField({ name: "nombre_apellido", required: false, max: 200 }));
  ensureField("telefono", () => new TextField({ name: "telefono", required: false, max: 20 }));
  ensureField("direccion", () => new TextField({ name: "direccion", required: false, max: 300 }));

  // Rules: admin (collection users) puede listar todos. El cliente sólo
  // puede ver/editar el propio. Registro público.
  collection.listRule = "@request.auth.collectionName = 'users' || @request.auth.id = id";
  collection.viewRule = "@request.auth.collectionName = 'users' || @request.auth.id = id";
  collection.createRule = "";
  collection.updateRule = "@request.auth.id = id || @request.auth.collectionName = 'users'";
  collection.deleteRule = "@request.auth.collectionName = 'users'";

  app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("clientes");
    return app.delete(collection);
  } catch (e) {
    return;
  }
});
