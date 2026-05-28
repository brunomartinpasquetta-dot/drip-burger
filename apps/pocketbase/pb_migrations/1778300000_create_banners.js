/// <reference path="../pb_data/types.d.ts" />
//
// Colección `banners` para carousel promocional en el home.
// - Público lee (sin filtros de fecha — el hook filtra en client por desde/hasta
//   para poder mostrar borradores futuros en admin sin cambiar reglas).
// - Solo ADMIN crea/edita/borra.
// - Imagen única, max 2MB, jpg/png/webp.
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.role = 'ADMIN'",
    "deleteRule": "@request.auth.role = 'ADMIN'",
    "updateRule": "@request.auth.role = 'ADMIN'",
    "listRule": "",
    "viewRule": "",
    "name": "banners",
    "type": "base",
    "system": false,
    "id": "pbc_banners_2026",
    "indexes": [],
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text4320641263",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "type": "text",
        "name": "titulo",
        "required": true,
        "max": 60,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "hidden": false,
        "system": false,
        "primaryKey": false,
        "presentable": true
      },
      {
        "type": "file",
        "name": "imagen",
        "required": true,
        "maxSelect": 1,
        "maxSize": 2097152,
        "mimeTypes": ["image/jpeg", "image/png", "image/webp"],
        "thumbs": [],
        "hidden": false,
        "system": false,
        "primaryKey": false,
        "presentable": false
      },
      {
        "type": "text",
        "name": "ctaTexto",
        "required": false,
        "max": 20,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "hidden": false,
        "system": false,
        "primaryKey": false,
        "presentable": false
      },
      {
        "type": "relation",
        "name": "ctaProductoId",
        "required": false,
        "collectionId": "pbc_1937395538",
        "cascadeDelete": false,
        "maxSelect": 1,
        "minSelect": 0,
        "hidden": false,
        "system": false,
        "primaryKey": false,
        "presentable": false
      },
      {
        "type": "bool",
        "name": "activo",
        "required": false,
        "hidden": false,
        "system": false,
        "primaryKey": false,
        "presentable": false
      },
      {
        "type": "date",
        "name": "desde",
        "required": false,
        "min": "",
        "max": "",
        "hidden": false,
        "system": false,
        "primaryKey": false,
        "presentable": false
      },
      {
        "type": "date",
        "name": "hasta",
        "required": false,
        "min": "",
        "max": "",
        "hidden": false,
        "system": false,
        "primaryKey": false,
        "presentable": false
      },
      {
        "type": "number",
        "name": "orden",
        "required": false,
        "onlyInt": false,
        "min": null,
        "max": null,
        "hidden": false,
        "system": false,
        "primaryKey": false,
        "presentable": false
      },
      {
        "hidden": false,
        "id": "autodate1539303564",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate6412190126",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ]
  });

  try {
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("Collection name must be unique")) {
      console.log("banners collection already exists, skipping");
      return;
    }
    throw e;
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("banners");
    return app.delete(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) return;
    throw e;
  }
});
