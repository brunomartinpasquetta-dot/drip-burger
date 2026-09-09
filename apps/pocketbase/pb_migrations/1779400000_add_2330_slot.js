/// <reference path="../pb_data/types.d.ts" />
//
// El cliente pidió una tanda más al final: 23:30.
// `orders.horario_reparto` es un SelectField — si no declaramos el valor acá,
// PB rechaza el pedido con "validation_in_invalid" y el checkout falla en
// producción aunque el frontend ya ofrezca el horario.
//
// Idempotente: solo toca la collection si falta algún valor. Reconstruimos el
// field CON EL MISMO id que tenía para que PB lo trate como update y no
// dropee la columna (perdería el horario de todos los pedidos históricos).
//
// La capacidad de medallones del slot nuevo NO se seedea: cuando falta la key
// en settings.slotCapacityPerSlot, tanto /api/slots/availability como el hook
// order-confirmation.pb.js caen al default de 20. El admin lo ajusta desde
// /gestion/config → Capacidad por turno.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  const field = collection.fields.getByName("horario_reparto");

  const desired = ["20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"];

  let needsUpdate = false;
  if (!field || !Array.isArray(field.values)) {
    needsUpdate = true;
  } else {
    for (const v of desired) {
      if (!field.values.includes(v)) { needsUpdate = true; break; }
    }
  }

  if (!needsUpdate) return;

  const keepId = field ? field.id : undefined;
  collection.fields.removeByName("horario_reparto");
  collection.fields.add(new SelectField({
    id: keepId,
    name: "horario_reparto",
    required: true,
    maxSelect: 1,
    values: desired,
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  const field = collection.fields.getByName("horario_reparto");
  const keepId = field ? field.id : undefined;
  collection.fields.removeByName("horario_reparto");
  collection.fields.add(new SelectField({
    id: keepId,
    name: "horario_reparto",
    required: true,
    maxSelect: 1,
    values: ["20:30", "21:00", "21:30", "22:00", "22:30", "23:00"],
  }));
  return app.save(collection);
});
