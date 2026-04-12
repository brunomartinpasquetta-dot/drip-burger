/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let records;
  try {
    records = app.findRecordsByFilter("products", "name='DIRTY DRIP'");
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("No records found, skipping");
      return;
    }
    throw e;
  }
  
  for (const record of records) {
    record.set("description", "Carne smash, cheddar, cebolla caramelizada, barbacoa y pan de papa. Incluye papas fritas.");
    record.set("simplePrice", 10000);
    record.set("doublePrice", 12000);
    record.set("triplePrice", 14000);
    record.set("hasMedallions", true);
    record.set("available", true);
    try {
      app.save(record);
    } catch (e) {
      if (e.message.includes("Value must be unique")) {
        console.log("Record with unique value already exists, skipping");
      } else {
        throw e;
      }
    }
  }
}, (app) => {
  // Rollback: original values not stored, manual restore needed
})
