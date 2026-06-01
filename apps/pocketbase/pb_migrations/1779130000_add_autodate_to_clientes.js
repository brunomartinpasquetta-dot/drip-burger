/// <reference path="../pb_data/types.d.ts" />
// Fix: el listado en /gestion daba 400 con "Something went wrong" porque
// el frontend ordena con `sort=-created` y la collection `clientes` NO
// tiene el campo `created`. En PB 0.23+ los autodate de sistema
// (`created`, `updated`) ya no se agregan automáticamente al crear una
// auth collection — hay que definirlos explícitamente. La migration
// original 1777400000 solo seteó name + type:"auth", por eso faltan.
//
// Bisección hecha: sort=-id → 200 OK, sort=-created → 400. Confirmado.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("clientes");

  const ensure = (name, opts) => {
    if (!collection.fields.getByName(name)) {
      collection.fields.add(new Field(Object.assign({ name, type: "autodate" }, opts)));
    }
  };

  ensure("created", { onCreate: true, onUpdate: false });
  ensure("updated", { onCreate: true, onUpdate: true });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("clientes");
  const c = collection.fields.getByName("created");
  if (c) collection.fields.removeById(c.id);
  const u = collection.fields.getByName("updated");
  if (u) collection.fields.removeById(u.id);
  return app.save(collection);
});
