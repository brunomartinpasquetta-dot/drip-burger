/// <reference path="../pb_data/types.d.ts" />
//
// Extiende el SelectField `forma_pago` de orders para aceptar "Mercado Pago"
// como tercer valor además de "Efectivo" y "Transferencia". Esto permite
// distinguir MP de transferencia bancaria sin colisionar con el schema actual.
//
// Idempotente: si los valores ya están seteados, no toca nada.
//
// NOTA: hasta que esta migración corra, MP y transferencia bancaria comparten
// el value "Transferencia" en el schema. El frontend distingue con un campo
// UI separado y mapea al submit. Una vez aplicada la migración, podés
// migrar el código a usar 'Mercado Pago' directamente sin colisión.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  const field = collection.fields.getByName("forma_pago");
  if (!field || field.type !== "select") return;

  const desired = ["Efectivo", "Transferencia", "Mercado Pago"];
  const current = field.values || [];
  const same =
    current.length === desired.length &&
    desired.every((v) => current.includes(v));
  if (same) return; // ya seteado

  // Reemplazar valores manteniendo el resto de la config del field.
  collection.fields.removeByName("forma_pago");
  collection.fields.add(new SelectField({
    name: "forma_pago",
    required: true,
    values: desired,
  }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("forma_pago");
  collection.fields.add(new SelectField({
    name: "forma_pago",
    required: true,
    values: ["Efectivo", "Transferencia"],
  }));
  app.save(collection);
});
