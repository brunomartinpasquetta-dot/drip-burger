/// <reference path="../pb_data/types.d.ts" />
//
// Agrega `ui_payment_choice` (text, optional) a orders. Captura el UI choice
// del cliente al checkout (Efectivo | MercadoPago | TransferenciaBancaria)
// para que el admin pueda distinguir MP de transferencia bancaria, ya que
// el SelectField forma_pago las colapsa a `Transferencia`.
//
// Idempotente.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");

  if (!collection.fields.getByName("ui_payment_choice")) {
    collection.fields.add(new TextField({
      name: "ui_payment_choice",
      required: false,
      max: 32,
    }));
  }

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("ui_payment_choice");
  return app.save(collection);
});
