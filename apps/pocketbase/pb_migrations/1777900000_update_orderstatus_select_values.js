/// <reference path="../pb_data/types.d.ts" />
//
// Actualiza los valores aceptados del SelectField `orderStatus` de orders
// para que matcheen el ORDER_STATUS_VALUES del frontend después del rename
// "En camino"→"Enviado", "Finalizado"→"Entregado".
//
// Pre-fix: el schema sólo aceptaba ["Pendiente","En preparación","Listo",
// "En camino","Finalizado","Cancelado"]. El frontend mandaba "Enviado" y
// PB rechazaba con 400 validation_invalid_value.
//
// Idempotente: si los valores ya están seteados, no toca nada.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  const field = collection.fields.getByName("orderStatus");
  if (!field || field.type !== "select") return;

  const desired = [
    "Pendiente",
    "En preparación",
    "Listo",
    "Enviado",
    "Entregado",
    "Cancelado",
  ];
  const current = field.values || [];
  const same =
    current.length === desired.length &&
    desired.every((v) => current.includes(v));
  if (same) return;

  // Reemplazar valores manteniendo el resto de la config del field.
  collection.fields.removeByName("orderStatus");
  collection.fields.add(new SelectField({
    name: "orderStatus",
    required: false,
    maxSelect: 1,
    values: desired,
  }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("orderStatus");
  collection.fields.add(new SelectField({
    name: "orderStatus",
    required: false,
    maxSelect: 1,
    values: ["Pendiente", "En preparación", "Listo", "En camino", "Finalizado", "Cancelado"],
  }));
  app.save(collection);
});
