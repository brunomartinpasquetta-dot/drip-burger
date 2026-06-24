// -----------------------------------------------------------------------------
// Zonificador V2 (portado de Sinatra) — paridad con el flujo OlaClick.
//
// Cascada VALIDADA por zona (no sólo por bbox):
//   1) Nominatim — params idénticos al standalone (viewbox Coronda + bounded=1
//      + countrycodes=ar + accept-language=es). Es el único geocoder que el
//      standalone usa, por eso va primero.
//   2) Georef (apis.datos.gob.ar) — fallback oficial AR. Filtra por depto
//      "San Jerónimo" + localidad Coronda + bbox para descartar homónimas.
//   3) Photon (komoot) — último recurso fuzzy sobre OSM.
//
// Para CADA provider que devuelve un punto en bbox: corremos point-in-polygon
// contra las features de `zonasDelivery` (loaded from PB). Si cae en zona →
// devolvemos. Si no → guardamos como candidato y seguimos al próximo provider
// (porque otro geocoder puede devolver coords distintas para la misma calle
// que sí caigan en zona).
//
// Cache persistente en localStorage (sólo zone-matches). Bump CACHE_KEY a
// v5 para invalidar entries stale del modo viejo (centro/alejada).
//
// Modos de cálculo (controlados desde settings via localCenterLoader):
//   - 'zonas'     -> point-in-polygon contra features
//   - 'distancia' -> base + km × porKm, cutoff maxKm
//   - 'fijo'     -> precio fijo (envio_base)
// -----------------------------------------------------------------------------

import { getZonas } from './zonasLoader';
import { getLocalCenter, getShippingConfig } from './localCenterLoader';

// Distancia Haversine (km) entre dos coords (lat,lng).
const haversineKm = (a, b) => {
	const R = 6371; // radio Tierra en km
	const toRad = (x) => (x * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const s1 = Math.sin(dLat / 2);
	const s2 = Math.sin(dLng / 2);
	const c = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
	return 2 * R * Math.asin(Math.sqrt(c));
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GEOREF_URL = 'https://apis.datos.gob.ar/georef/api/direcciones';
const PHOTON_URL = 'https://photon.komoot.io/api';

// Viewbox EXACTO del standalone zonificador-coronda-v4.html. Paridad 1:1 con
// el HTML que el negocio usó para dibujar el polígono — cualquier desvío hace
// que Nominatim devuelva coords distintas. NO aproximar este valor.
// Formato Nominatim viewbox: minLng,maxLat,maxLng,minLat
const NOMINATIM_VIEWBOX = '-60.95,-31.94,-60.88,-32.00';

// bbox AMPLIO para el post-filter (Georef/Photon no usan viewbox). Cubre todo
// el ejido de Coronda + zona rural cercana. Lo que queda fuera = otra ciudad,
// no entregamos ahí (notFound).
const CORONDA_BBOX = { minLng: -61.00, minLat: -32.05, maxLng: -60.85, maxLat: -31.92 };

const CACHE_KEY = 'dripburger:geocode:v5';
const memCache = new Map();

const loadCache = () => {
	if (memCache.size > 0) return memCache;
	try {
		if (typeof localStorage === 'undefined') return memCache;
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return memCache;
		const obj = JSON.parse(raw);
		for (const [k, v] of Object.entries(obj)) memCache.set(k, v);
	} catch {}
	return memCache;
};

const persistCache = () => {
	try {
		if (typeof localStorage === 'undefined') return;
		const obj = {};
		for (const [k, v] of memCache) obj[k] = v;
		localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
	} catch {}
};

const normalizeKey = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Logs activables: localStorage.setItem('dripburger:zone:debug','1')
const debugEnabled = () => {
	try {
		if (typeof localStorage === 'undefined') return false;
		return localStorage.getItem('dripburger:zone:debug') === '1';
	} catch { return false; }
};
const log = (...args) => { if (debugEnabled()) console.log('[ZONE]', ...args); };

const inBbox = (lat, lng) =>
	Number.isFinite(lat) && Number.isFinite(lng) &&
	lat >= CORONDA_BBOX.minLat && lat <= CORONDA_BBOX.maxLat &&
	lng >= CORONDA_BBOX.minLng && lng <= CORONDA_BBOX.maxLng;

const fetchJson = async (url, init) => {
	try {
		log('GET', url);
		const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
		const res = await fetch(url, init);
		const ms = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - t0);
		log('  status', res.status, ms + 'ms');
		if (!res.ok) return null;
		return await res.json();
	} catch (err) {
		console.warn('[ZONE] fetch falló:', url, err);
		return null;
	}
};

// ── Provider 1: Nominatim ────────────────────────────────────────────────
const tryNominatim = async (raw) => {
	const q = `${raw}, Coronda, Santa Fe, Argentina`;
	const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&countrycodes=ar&limit=1&viewbox=${NOMINATIM_VIEWBOX}&bounded=1`;
	const data = await fetchJson(url, { headers: { 'Accept-Language': 'es' } });
	if (!Array.isArray(data) || data.length === 0) return null;
	const lat = parseFloat(data[0].lat);
	const lng = parseFloat(data[0].lon);
	if (!inBbox(lat, lng)) return null;
	return { lat, lng, source: 'nominatim', display: data[0].display_name || '' };
};

// ── Provider 2: Georef AR (filtra por dpto San Jerónimo / localidad Coronda) ──
const georefSearch = async (raw, extra = {}) => {
	const params = new URLSearchParams({
		direccion: raw,
		provincia: 'santa fe',
		max: '10',
		...extra,
	});
	const data = await fetchJson(`${GEOREF_URL}?${params}`);
	return (data?.direcciones || []).map((d) => ({
		lat: d.ubicacion?.lat,
		lng: d.ubicacion?.lon,
		display: d.nomenclatura || '',
		depto: d.departamento?.nombre || '',
		localidad: d.localidad_censal?.nombre || '',
	}));
};

const tryGeoref = async (raw) => {
	// Búsqueda 1: provincia=santa fe, ranking por dpto San Jerónimo / localidad Coronda.
	let list = await georefSearch(raw);
	let pick = list.find(
		(r) => inBbox(r.lat, r.lng) && /san jeronimo|coronda/i.test(`${r.depto} ${r.localidad}`)
	);
	if (!pick) pick = list.find((r) => inBbox(r.lat, r.lng));
	// Búsqueda 2: si nada cayó en bbox, acotar a depto San Jerónimo explícito.
	if (!pick) {
		list = await georefSearch(raw, { departamento: 'san jeronimo' });
		pick = list.find((r) => inBbox(r.lat, r.lng));
	}
	if (!pick) return null;
	return { lat: pick.lat, lng: pick.lng, source: 'georef', display: pick.display };
};

// ── Provider 3: Photon (komoot) ──────────────────────────────────────────
const tryPhoton = async (raw) => {
	const params = new URLSearchParams({
		q: `${raw}, Coronda, Santa Fe`,
		limit: '5',
		lang: 'es',
		bbox: `${CORONDA_BBOX.minLng},${CORONDA_BBOX.minLat},${CORONDA_BBOX.maxLng},${CORONDA_BBOX.maxLat}`,
	});
	const data = await fetchJson(`${PHOTON_URL}?${params}`);
	const features = data?.features || [];
	for (const f of features) {
		const lng = f.geometry?.coordinates?.[0];
		const lat = f.geometry?.coordinates?.[1];
		if (inBbox(lat, lng)) {
			return { lat, lng, source: 'photon', display: f.properties?.name || '' };
		}
	}
	return null;
};

const PROVIDERS = [
	{ name: 'nominatim', fn: tryNominatim },
	{ name: 'georef', fn: tryGeoref },
	{ name: 'photon', fn: tryPhoton },
];

// ── Point in polygon (ray-casting). polygon = [[lng,lat],...]. ───────────
const pointInPolygon = (point, polygon) => {
	const x = point.lng;
	const y = point.lat;
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i][0], yi = polygon[i][1];
		const xj = polygon[j][0], yj = polygon[j][1];
		const intersect = ((yi > y) !== (yj > y)) &&
			(x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
};

// Construye un "feature" sintético para los modos sin polígonos (distancia
// / fijo). Compatible con buildZoneResult: necesita .properties con id,
// nombre, tarifa, color.
const makeSyntheticFeature = ({ id, nombre, tarifa, color = '#F5A800' }) => ({
	type: 'Feature',
	geometry: null,
	properties: { id, nombre, tarifa, color, tipo: 'sintetico' },
});

const findZone = (point) => {
	// Decide el modo de envío según settings (cargado por localCenterLoader).
	//   'distancia' -> precio_envio = base + km × porKm, cutoff maxKm.
	//   'fijo'      -> precio_envio = base, sin cutoff.
	//   'zonas'     -> features de zonas_delivery (círculos prioridad, luego
	//                  polígonos). Default si no hay config.
	const shipping = getShippingConfig();
	const center = getLocalCenter();

	// --- Modo DISTANCIA RECORRIDA (OlaClick "Distancia recorrida") ---
	if (shipping.modo === 'distancia' && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
		const dist = haversineKm(center, point);
		const maxKm = Number(shipping.maxKm) || 0;
		if (maxKm > 0 && dist > maxKm) return null; // fuera de cobertura
		const base = Number(shipping.base) || 0;
		const porKm = Number(shipping.porKm) || 0;
		const tarifa = Math.round(base + dist * porKm);
		return makeSyntheticFeature({
			id: 'DIST',
			nombre: `${dist.toFixed(1)} km`,
			tarifa,
		});
	}

	// --- Modo PRECIO FIJO ---
	if (shipping.modo === 'fijo') {
		const tarifa = Number(shipping.base) || 0;
		return makeSyntheticFeature({
			id: 'FIJO',
			nombre: 'Envío',
			tarifa,
		});
	}

	// --- Modo ZONAS (default) ---
	const zonas = getZonas();
	const features = Array.isArray(zonas.features) ? zonas.features : [];

	// Círculos primero (modelo "Rangos personalizados" de OlaClick).
	const circulos = features
		.filter((f) => f.properties.tipo === 'circulo' && Number(f.properties.radioKm) > 0)
		.sort((a, b) => Number(a.properties.radioKm) - Number(b.properties.radioKm));
	if (circulos.length > 0 && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
		const dist = haversineKm(center, point);
		for (const f of circulos) {
			if (dist <= Number(f.properties.radioKm)) return f;
		}
		// Fuera del último radio = fuera de zona (no cae a polígonos).
		return null;
	}

	// Polígonos como fallback / coexistencia.
	for (const feature of features) {
		if (feature.properties.tipo === 'circulo') continue;
		const ring = feature?.geometry?.coordinates?.[0];
		if (Array.isArray(ring) && pointInPolygon(point, ring)) {
			return feature;
		}
	}
	return null;
};

const buildZoneResult = (feature, point, source) => ({
	zonaId: feature.properties.id,
	zonaNombre: feature.properties.nombre,
	tarifa: Number(feature.properties.tarifa) || 0,
	color: feature.properties.color || '#F5A800',
	lat: point.lat,
	lng: point.lng,
	source,
});

const buildOutOfZoneResult = (point, source) => ({
	zonaId: null,
	zonaNombre: 'Fuera de zona',
	tarifa: null,
	color: '#ef4444',
	lat: point.lat,
	lng: point.lng,
	source,
});

// ── API pública ──────────────────────────────────────────────────────────

/**
 * Geocodifica una dirección. Cascada simple: primer provider que devuelve
 * punto en bbox gana. Sin validación contra zonas (eso lo hace
 * determinarZonaV2). Mantiene la firma legacy {lat, lng}.
 */
export const geocodeAddress = async (direccion) => {
	const text = String(direccion || '').trim();
	if (!text) return null;
	for (const { name, fn } of PROVIDERS) {
		const p = await fn(text);
		if (p) {
			log('geocodeAddress resuelto por', name, p);
			return { lat: p.lat, lng: p.lng };
		}
	}
	return null;
};

/**
 * Determina zona de envío validando contra polígonos en cada provider.
 * Si un provider devuelve coords pero quedan fuera de toda zona, guarda
 * el candidato y prueba el siguiente provider — otro geocoder puede dar
 * coords distintas para la misma calle que sí caigan en zona.
 *
 * @returns { zonaId, zonaNombre, tarifa, color, lat, lng, source } si zona
 *          { zonaId: null, zonaNombre: 'Fuera de zona', ... } si geocodificó
 *            pero ningún provider cayó en zona
 *          null si ningún provider devolvió coords válidas
 */
export const determinarZonaV2 = async (direccion) => {
	const text = String(direccion || '').trim();
	if (!text) return null;
	const key = normalizeKey(text);
	const cache = loadCache();
	if (cache.has(key)) {
		const v = cache.get(key);
		log('cache hit', key, v);
		return v;
	}

	log('cascada para:', text);
	let lastCandidate = null;
	for (const { name, fn } of PROVIDERS) {
		const p = await fn(text);
		if (!p) {
			log('  ', name, 'sin resultado');
			continue;
		}
		log('  ', name, '→', p);
		const zone = findZone(p);
		if (zone) {
			const result = buildZoneResult(zone, p, name);
			log('  ZONA', zone.properties.id, '— cache HIT, salimos');
			cache.set(key, result);
			persistCache();
			return result;
		}
		log('  ', name, 'fuera de toda zona, sigo con próximo provider');
		if (!lastCandidate) lastCandidate = p;
	}

	if (lastCandidate) {
		log('ningún provider cayó en zona — devuelvo Fuera de zona con coords del primer candidato');
		// NO cacheamos fuera-de-zona: puede ser falso negativo de un provider
		// transitorio o bbox marginal. Reintentar la próxima vez sale barato.
		return buildOutOfZoneResult(lastCandidate, lastCandidate.source);
	}
	log('ningún provider resolvió la dirección');
	return null;
};

export const zonasDisponibles = () => getZonas().features.map((f) => ({
	id: f.properties.id,
	nombre: f.properties.nombre,
	tarifa: f.properties.tarifa,
	color: f.properties.color,
}));

/** Compat con shippingZone.js viejo. Devuelve 'alejada' por default. */
export const determinarZona = () => 'alejada';
