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
// Mutación in-place: editamos `field.values` en lugar de remove+add para
// no perder otras props del field (required, maxSelect, presentable, etc).
// Idempotente: si los valores ya están seteados, sale sin tocar nada.
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

  // Mutación in-place del array de valores aceptados.
  field.values = desired;
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  const field = collection.fields.getByName("orderStatus");
  if (!field || field.type !== "select") return;
  field.values = ["Pendiente", "En preparación", "Listo", "En camino", "Finalizado", "Cancelado"];
  app.save(collection);
});
