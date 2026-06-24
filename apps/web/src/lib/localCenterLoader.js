import pb from '@/lib/pocketbaseClient';

// Portado de Sinatra (Fase F/F2 OlaClick). Lee de `settings`:
//   - local_lat / local_lng        coords del local (centro para Haversine)
//   - modo_envio                   'zonas' | 'distancia' | 'fijo'
//   - envio_base                   precio base (modo 'distancia' y 'fijo')
//   - envio_por_km                 precio por km (modo 'distancia')
//   - envio_max_km                 cutoff km (modo 'distancia'); fuera → null
//
// Defaults: si PB no responde, usamos el local de Drip Burger
// (Juan de Garay 2189, Coronda). Modo default 'zonas' para mantener compat
// con el polígono CENTRO del fallback (zona-centro-coronda equivalente).

const FALLBACK_CENTER = { lat: -31.97315, lng: -60.92054 }; // Juan de Garay 2189, Coronda
const FALLBACK_SHIPPING = {
	modo: 'zonas',
	base: 0,
	porKm: 0,
	maxKm: 0,
};

let cached = { ...FALLBACK_CENTER };
let shippingCached = { ...FALLBACK_SHIPPING };
const listeners = new Set();
const notify = () => { for (const cb of listeners) try { cb(cached, shippingCached); } catch {} };

export const getLocalCenter = () => cached;
export const getShippingConfig = () => shippingCached;

export const loadLocalCenter = async () => {
	try {
		const recs = await pb.collection('settings').getList(1, 1, { requestKey: null });
		if (recs.items.length > 0) {
			const r = recs.items[0];
			const lat = Number(r.local_lat);
			const lng = Number(r.local_lng);
			if (Number.isFinite(lat) && Number.isFinite(lng)) {
				cached = { lat, lng };
			} else {
				cached = { ...FALLBACK_CENTER };
			}
			// Shipping mode + params. Si el record no tiene los campos
			// (PB pre-migración) caen a defaults vía Number(undefined)=NaN.
			const modo = String(r.modo_envio || '').trim().toLowerCase();
			shippingCached = {
				modo: ['distancia', 'fijo', 'zonas'].includes(modo) ? modo : 'zonas',
				base: Number.isFinite(Number(r.envio_base)) ? Number(r.envio_base) : 0,
				porKm: Number.isFinite(Number(r.envio_por_km)) ? Number(r.envio_por_km) : 0,
				maxKm: Number.isFinite(Number(r.envio_max_km)) ? Number(r.envio_max_km) : 0,
			};
			notify();
			return { center: cached, shipping: shippingCached };
		}
	} catch (err) {
		console.warn('[localCenterLoader] PB read failed, using fallback:', err?.message || err);
	}
	cached = { ...FALLBACK_CENTER };
	shippingCached = { ...FALLBACK_SHIPPING };
	notify();
	return { center: cached, shipping: shippingCached };
};

export const subscribeLocalCenter = (cb) => {
	listeners.add(cb);
	return () => { listeners.delete(cb); };
};
