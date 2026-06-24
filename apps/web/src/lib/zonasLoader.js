import pb from '@/lib/pocketbaseClient';
import fallbackJson from '@/lib/zonasDelivery.json';

// Fase C OlaClick (portado de Sinatra): zonas viven en collection PB
// `zonas_delivery`. Este módulo abstrae la carga + el formato GeoJSON
// que consume el resto del código (point-in-polygon + Leaflet polygons).
//
// Estrategia:
//   1. Al primer llamado, intenta GET zonas_delivery.
//   2. Si responde OK, convierte a formato GeoJSON FeatureCollection y
//      cachea en memoria.
//   3. Si PB falla (network, rules, collection no existe), cae al JSON
//      estático bundleado. Esto garantiza que el zonificador SIEMPRE
//      funcione, aunque el server esté caído.
//   4. Subscribe('*') para refrescar el cache cuando el admin edita
//      zonas.

let cached = null;          // FeatureCollection actual (de PB o fallback)
const listeners = new Set(); // callbacks notificados en cada cambio

const recordToFeature = (rec) => ({
	type: 'Feature',
	geometry: { type: 'Polygon', coordinates: [rec.coords || []] },
	properties: {
		id: rec.zona_id,
		nombre: rec.nombre,
		color: rec.color,
		tarifa: Number(rec.tarifa) || 0,
		orden: Number(rec.orden) || 0,
		tipo: rec.tipo || 'poligono', // 'circulo' | 'poligono'
		radioKm: Number(rec.radio_km) || 0,
		recordId: rec.id, // necesario para edit/delete desde admin
	},
});

const buildFeatureCollection = (features) => ({ type: 'FeatureCollection', features });

const notify = () => { for (const cb of listeners) try { cb(cached); } catch {} };

export const getZonas = () => cached || fallbackJson;

export const loadZonas = async () => {
	try {
		const records = await pb.collection('zonas_delivery').getFullList({
			filter: 'activa = true || activa = null',
			sort: 'orden,zona_id',
			requestKey: null,
		});
		if (records.length === 0) {
			// Collection vacía → fallback. Útil en local sin seed.
			cached = fallbackJson;
		} else {
			cached = buildFeatureCollection(records.map(recordToFeature));
		}
	} catch (err) {
		console.warn('[zonasLoader] PB load fallback to JSON:', err?.message || err);
		cached = fallbackJson;
	}
	notify();
	return cached;
};

export const subscribeZonas = (cb) => {
	listeners.add(cb);
	// Subscripción realtime a PB — propaga edits del admin a clientes ya
	// abiertos en el carrito (no necesitan F5).
	let pbUnsub = null;
	pb.collection('zonas_delivery').subscribe('*', () => loadZonas())
		.then((unsub) => { pbUnsub = unsub; })
		.catch(() => {});
	return () => {
		listeners.delete(cb);
		if (pbUnsub) try { pbUnsub(); } catch {}
	};
};
