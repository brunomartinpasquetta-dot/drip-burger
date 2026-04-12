/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const record = new Record(collection);
  record.set("email", "admin@drip.com");
  record.setPassword("admin123");
  record.set("name", "admin");
  record.set("role", "ADMIN");
  record.set("surname", "Admin");
  record.set("address", "Admin Address");
  record.set("phone", "0000000000");
  record.set("nombre_apellido", "Admin User");
  record.set("telefono", "0000000000");
  record.set("direccion", "Admin Address");
  try {
    return app.save(record);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
      return;
    }
    throw e;
  }
}, (app) => {
  try {
    const record = app.findFirstRecordByData("users", "email", "admin@drip.com");
    app.delete(record);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Auth record not found, skipping rollback");
      return;
    }
    throw e;
  }
})
