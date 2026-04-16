/// <reference path="../pb_data/types.d.ts" />
//
// Agrega "Cancelado" como opción válida del select orderStatus en la
// collection orders. Idempotente: solo actualiza si falta.
// El hook order-confirmation.pb.js y el endpoint /slots/availability
// ya excluyen orderStatus="Cancelado" del conteo de medallones, así
// que al cancelar un pedido los medallones de la tanda se liberan.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  const field = collection.fields.getByName("orderStatus");

  const desired = ["Pendiente", "En preparación", "Listo", "En camino", "Finalizado", "Cancelado"];

  // Solo reemplazar el field si falta algún valor nuevo. Evita romper data
  // existente que ya usa los otros estados.
  let needsUpdate = false;
  if (!field || !Array.isArray(field.values)) {
    needsUpdate = true;
  } else {
    for (const v of desired) {
      if (!field.values.includes(v)) { needsUpdate = true; break; }
    }
  }

  if (!needsUpdate) return;

  collection.fields.removeByName("orderStatus");
  collection.fields.add(new SelectField({
    name: "orderStatus",
    required: true,
    maxSelect: 1,
    values: desired,
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("orderStatus");
  collection.fields.add(new SelectField({
    name: "orderStatus",
    required: true,
    maxSelect: 1,
    values: ["Pendiente", "En preparación", "Listo", "En camino", "Finalizado"],
  }));
  return app.save(collection);
});
