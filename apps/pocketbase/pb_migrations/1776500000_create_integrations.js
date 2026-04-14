/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Crear la colección "integrations" si no existe (usando patrón empty → add fields)
  let collection;
  try {
    collection = app.findCollectionByNameOrId("integrations");
  } catch (e) {
    collection = null;
  }

  if (!collection) {
    collection = new Collection({
      name: "integrations",
      type: "base",
    });
    app.save(collection);
    collection = app.findCollectionByNameOrId("integrations");
  }

  // 2. Agregar campos (idempotente — skip si ya existen)
  if (!collection.fields.getByName("key")) {
    collection.fields.add(new TextField({
      name: "key",
      required: true,
      max: 64,
    }));
  }
  if (!collection.fields.getByName("enabled")) {
    collection.fields.add(new BoolField({
      name: "enabled",
      required: false,
    }));
  }
  if (!collection.fields.getByName("status")) {
    collection.fields.add(new TextField({
      name: "status",
      required: false,
      max: 32,
    }));
  }
  if (!collection.fields.getByName("config")) {
    collection.fields.add(new JSONField({
      name: "config",
      required: false,
      maxSize: 2000000,
    }));
  }
  if (!collection.fields.getByName("lastCheckedAt")) {
    collection.fields.add(new DateField({
      name: "lastCheckedAt",
      required: false,
    }));
  }
  if (!collection.fields.getByName("lastError")) {
    collection.fields.add(new TextField({
      name: "lastError",
      required: false,
      max: 1000,
    }));
  }

  // 3. Índice único en key
  collection.indexes = ["CREATE UNIQUE INDEX idx_integrations_key ON integrations (key)"];

  // 4. Reglas de acceso — solo ADMIN
  collection.listRule = "@request.auth.role = 'ADMIN'";
  collection.viewRule = "@request.auth.role = 'ADMIN'";
  collection.createRule = "@request.auth.role = 'ADMIN'";
  collection.updateRule = "@request.auth.role = 'ADMIN'";
  collection.deleteRule = null;

  app.save(collection);

  // 5. Seed idempotente: whatsapp + mercadopago con enabled=false, status=disconnected
  const seedRows = [
    {
      key: "whatsapp",
      enabled: false,
      status: "disconnected",
      config: { sessionExists: false, phoneNumber: "" },
    },
    {
      key: "mercadopago",
      enabled: false,
      status: "disconnected",
      config: { accessToken: "", publicKey: "", webhookSecret: "" },
    },
  ];

  for (const row of seedRows) {
    let existing = null;
    try {
      existing = app.findFirstRecordByData("integrations", "key", row.key);
    } catch (e) {
      existing = null;
    }
    if (!existing) {
      const rec = new Record(collection);
      rec.set("key", row.key);
      rec.set("enabled", row.enabled);
      rec.set("status", row.status);
      rec.set("config", row.config);
      app.save(rec);
    }
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("integrations");
    return app.delete(collection);
  } catch (e) {
    return;
  }
});
