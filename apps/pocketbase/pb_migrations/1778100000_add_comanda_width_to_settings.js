/// <reference path="../pb_data/types.d.ts" />
//
// Selector de ancho de papel de la impresora térmica: '58' o '80' (mm).
// Default '80' (drip-burger venía operando con 80mm). El admin puede
// cambiar a '58' desde /gestion/config si la impresora es más chica.
// Idempotente, aditivo, no toca pedidos ni jornadas existentes.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("settings");
  if (!collection.fields.getByName("comanda_width")) {
    collection.fields.add(new TextField({ name: "comanda_width", required: false, max: 4 }));
    app.save(collection);

    // Default '80' al settings singleton si está vacío
    try {
      const list = app.findRecordsByFilter("settings", "id != ''", "", 1);
      if (list && list.length > 0) {
        const rec = list[0];
        if (!rec.get("comanda_width")) {
          rec.set("comanda_width", "80");
          app.save(rec);
        }
      }
    } catch (e) { /* noop */ }
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("settings");
  collection.fields.removeByName("comanda_width");
  return app.save(collection);
});
