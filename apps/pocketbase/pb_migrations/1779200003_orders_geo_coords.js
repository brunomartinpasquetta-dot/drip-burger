/// <reference path="../pb_data/types.d.ts" />
// Portado de Sinatra (Fase F2 OlaClick) — guardamos lat/lng del cliente
// en el pedido. Se usan para inyectar el link de Google Maps en el ticket
// impreso y en el mensaje de WhatsApp al delivery.
//
// Ambos opcionales: si el geocoder no resuelve (cliente fuera de zona
// igual quiere pedir) el pedido se crea sin coords y el delivery cae al
// flujo viejo (copiar dirección a mano).
migrate((app) => {
  const o = app.findCollectionByNameOrId("orders");
  if (!o) return;
  if (!o.fields.getByName("lat")) {
    o.fields.add(new Field({ name: "lat", type: "number", required: false }));
  }
  if (!o.fields.getByName("lng")) {
    o.fields.add(new Field({ name: "lng", type: "number", required: false }));
  }
  app.save(o);
}, (app) => {
  const o = app.findCollectionByNameOrId("orders");
  if (!o) return;
  for (const name of ["lat", "lng"]) {
    const f = o.fields.getByName(name);
    if (f) o.fields.removeById(f.id);
  }
  app.save(o);
});
