/// <reference path="../pb_data/types.d.ts" />
// Sub-modo dentro de modo_envio='zonas': elegir qué geometría se usa para
// cobrar el envío. Hasta ahora findZone() priorizaba SIEMPRE los círculos
// (si había al menos uno activo, los polígonos nunca se consultaban). El
// cliente dibujó polígonos pero no tenía forma de activarlos.
//
//   zona_tipo = 'circulo'  -> usa los círculos (rangos por radio). DEFAULT,
//                             preserva el comportamiento previo.
//   zona_tipo = 'poligono' -> usa los polígonos (point-in-polygon), ignora
//                             los círculos.
//
// Solo aplica cuando modo_envio='zonas'. En 'distancia'/'fijo' no se mira.
migrate((app) => {
  const s = app.findCollectionByNameOrId("settings");
  if (!s) return;

  if (!s.fields.getByName("zona_tipo")) {
    s.fields.add(new Field({
      name: "zona_tipo",
      type: "select",
      required: false,
      maxSelect: 1,
      values: ["circulo", "poligono"],
    }));
  }
  app.save(s);

  // Seed: 'circulo' en el primer settings record si no está seteado, para no
  // cambiar el comportamiento actual hasta que el admin lo cambie a mano.
  try {
    const recs = app.findAllRecords("settings");
    for (const r of recs) {
      if (!r.get("zona_tipo")) {
        r.set("zona_tipo", "circulo");
        app.save(r);
      }
    }
  } catch (e) {
    // no-op; se setea desde el admin si falla acá
  }
}, (app) => {
  const s = app.findCollectionByNameOrId("settings");
  if (!s) return;
  const f = s.fields.getByName("zona_tipo");
  if (f) s.fields.removeById(f.id);
  app.save(s);
});
