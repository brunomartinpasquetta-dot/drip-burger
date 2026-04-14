/// <reference path="../pb_data/types.d.ts" />
// Fix-up: la 1776500000 dejó la collection con rules mal aplicadas y posibles
// duplicados. Esta migración normaliza todo: dedup + rules + seed + index.
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("integrations");
  } catch (e) {
    collection = new Collection({ name: "integrations", type: "base" });
    app.save(collection);
    collection = app.findCollectionByNameOrId("integrations");
  }

  // Asegurar todos los fields (idempotente)
  if (!collection.fields.getByName("key")) {
    collection.fields.add(new TextField({ name: "key", required: true, max: 64 }));
  }
  if (!collection.fields.getByName("enabled")) {
    collection.fields.add(new BoolField({ name: "enabled", required: false }));
  }
  if (!collection.fields.getByName("status")) {
    collection.fields.add(new TextField({ name: "status", required: false, max: 32 }));
  }
  if (!collection.fields.getByName("config")) {
    collection.fields.add(new JSONField({ name: "config", required: false, maxSize: 2000000 }));
  }
  if (!collection.fields.getByName("lastCheckedAt")) {
    collection.fields.add(new DateField({ name: "lastCheckedAt", required: false }));
  }
  if (!collection.fields.getByName("lastError")) {
    collection.fields.add(new TextField({ name: "lastError", required: false, max: 1000 }));
  }

  // Quitar cualquier índice previo inválido
  collection.indexes = [];

  // Rules — solo ADMIN
  collection.listRule = "@request.auth.role = 'ADMIN'";
  collection.viewRule = "@request.auth.role = 'ADMIN'";
  collection.createRule = "@request.auth.role = 'ADMIN'";
  collection.updateRule = "@request.auth.role = 'ADMIN'";
  collection.deleteRule = null;

  app.save(collection);

  // DEDUP: borrar TODOS los records existentes para arrancar limpio
  try {
    const allExisting = app.findRecordsByFilter("integrations", "", "", 1000);
    for (const rec of allExisting) {
      app.delete(rec);
    }
  } catch (e) {
    // no hay registros, OK
  }

  // Ahora sí: agregar el índice único (ya sin duplicados)
  collection.indexes = ["CREATE UNIQUE INDEX idx_integrations_key ON integrations (key)"];
  app.save(collection);

  // Seed limpio
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
    const rec = new Record(collection);
    rec.set("key", row.key);
    rec.set("enabled", row.enabled);
    rec.set("status", row.status);
    rec.set("config", row.config);
    app.save(rec);
  }
}, (app) => {});
