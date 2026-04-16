/// <reference path="../pb_data/types.d.ts" />
//
// Soporte para medallones 4 y 5 por producto. Agrega quadruplePrice y
// quintuplePrice como NumberField opcionales a la collection `products`.
// Si un producto los deja vacíos/0, el ProductCard NO muestra esas opciones
// — permite a cada producto definir hasta dónde ofrece (uno solo hasta triple,
// otro hasta quíntuple). Idempotente.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");

  if (!collection.fields.getByName("quadruplePrice")) {
    collection.fields.add(new NumberField({
      name: "quadruplePrice",
      required: false,
      min: 0,
    }));
  }

  if (!collection.fields.getByName("quintuplePrice")) {
    collection.fields.add(new NumberField({
      name: "quintuplePrice",
      required: false,
      min: 0,
    }));
  }

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.fields.removeByName("quadruplePrice");
  collection.fields.removeByName("quintuplePrice");
  return app.save(collection);
});
