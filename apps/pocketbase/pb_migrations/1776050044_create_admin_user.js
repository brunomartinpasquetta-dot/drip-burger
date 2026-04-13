/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");

  let record;
  try {
    record = app.findFirstRecordByData("users", "email", "admin@drip.com");
  } catch (e) {
    record = new Record(collection);
    record.set("email", "admin@drip.com");
    record.set("name", "Admin");
    record.set("surname", "Drip");
    record.set("nombre_apellido", "Admin Drip");
    record.set("telefono", "0000000000");
    record.set("phone", "0000000000");
    record.set("direccion", "Admin Address");
    record.set("address", "Admin Address");
  }

  record.setPassword("admin123");
  record.set("role", "ADMIN");
  record.set("emailVisibility", true);
  record.set("verified", true);

  return app.save(record);
}, (app) => {
  try {
    const record = app.findFirstRecordByData("users", "email", "admin@drip.com");
    return app.delete(record);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      return;
    }
    throw e;
  }
});
