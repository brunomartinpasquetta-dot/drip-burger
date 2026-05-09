// -----------------------------------------------------------------------------
// Zonificador V2 para Coronda — adaptado del shippingZoneV2 de Sinatra.
//
// Cascada de geocoding:
//   1) Nominatim (OSM) — viewbox/bbox de Coronda + bounded=1.
//   2) Georef (apis.datos.gob.ar) — fallback oficial AR, dpto San Jerónimo.
//   3) Photon (komoot) — último recurso fuzzy sobre OSM.
//
// Para CADA provider que devuelve un punto en bbox: corremos point-in-polygon
// contra el polígono de zona centro. Si está adentro → 'centro'. Si quedó
// dentro del bbox de Coronda pero fuera del polígono → 'alejada'. Si nunca
// resolvió coords → null.
//
// Las TARIFAS siguen viniendo de `settings` (precio_envio_centro /
// precio_envio_alejado) — el zonificador sólo decide en qué zona cae la
// dirección. Esto mantiene el panel admin tal cual y permite cambiar
// tarifas sin tocar código.
//
// Cache persistente en localStorage. Bump CACHE_KEY para invalidar entries
// stale si cambia el polígono o la lógica.
// -----------------------------------------------------------------------------

import zonaCentroGeoJson from './zona-centro-coronda.json';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GEOREF_URL = 'https://apis.datos.gob.ar/georef/api/direcciones';
const PHOTON_URL = 'https://photon.komoot.io/api';

// Viewbox de Coronda + alrededores (cubre todo el ejido y rural cercano).
// Coronda está en lat -31.97, lng -60.92 aprox. Margen generoso en todas
// direcciones para que Nominatim no descarte direcciones del borde.
const NOMINATIM_VIEWBOX = '-61.00,-31.92,-60.85,-32.05';

// bbox para post-filter: descarta resultados que cayeron en otra ciudad
// (Santa Fe Capital, Rosario, San Carlos Centro, etc).
const CORONDA_BBOX = { minLng: -61.00, minLat: -32.05, maxLng: -60.85, maxLat: -31.92 };

const CACHE_KEY = 'dripburger:geocode:v1';
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

// ── Provider 2: Georef AR (filtra por dpto San Jerónimo) ────────────────
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
	// Búsqueda 1: provincia=santa fe, ranking por dpto San Jerónimo o localidad Coronda.
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

// ── Fallback manual: calles conocidas de Coronda ────────────────────────
// Cuando los 3 geocoders fallan o devuelven coords fuera del bbox de
// Coronda (típicamente porque la calle está mal indexada en OSM/Georef),
// matcheamos por nombre y devolvemos la zona directamente sin lat/lng.
//
// Cómo agregar una calle: poná el nombre normalizado (lowercase, sin
// tildes ni puntos, sin "calle/av") en la lista de la zona correspondiente.
// El match es bidireccional case-insensitive (substring), así que aceptás
// abreviaturas razonables ("san martin" matchea "calle san martin 1500").
const STREETS_CENTRO_CORONDA = [
	'san martin',
	'san jeronimo',
	'belgrano',
	'sarmiento',
	'rivadavia',
	'mitre',
	'moreno',
	'italia',
	'espana',
	'9 de julio',
	'25 de mayo',
	'eva peron',
	'saavedra',
	'falucho',
	'pringles',
	'fray mamerto esquiu',
	'fray m esquiu',
	'almafuerte',
	'cervantes',
	'lisandro de la torre',
	'sarah zabala',
	'luciano molinas',
	'chizzini melo',
	'santo tome',
	'maciel',
	'almte brown',
	'almirante brown',
	'arocena',
	'bv orono',
	'bulevar orono',
	'orono',
	'guemes',
	'garay',
	'juan de garay',
	'alberdi',
	'derqui',
	'general lopez',
	'hipolito yrigoyen',
	'hipolito irigoyen',
	'yrigoyen',
	'irigoyen',
	'av hector lopez',
	'hector lopez',
];

// Normaliza el string libre del usuario para matcheo: lowercase, sin
// tildes, sin puntos/comas, prefijos de calle removidos, espacios
// colapsados. Devuelve solo la parte del nombre de calle (sin altura).
const normalizeStreetName = (raw) => {
	if (!raw) return '';
	let t = String(raw)
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[.,]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	t = t.replace(/^(av|avenida|calle|pje|pasaje|bv|bulevar)\s+/i, '');
	// Sacar la altura (números) — nos quedamos con el nombre
	t = t.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim();
	return t;
};

const matchesKnownCentroStreet = (rawAddress) => {
	const street = normalizeStreetName(rawAddress);
	if (!street) return false;
	return STREETS_CENTRO_CORONDA.some(
		(known) => street.includes(known) || known.includes(street)
	);
};

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

const isInCentro = (point) => {
	for (const feature of zonaCentroGeoJson.features) {
		const ring = feature?.geometry?.coordinates?.[0];
		if (Array.isArray(ring) && pointInPolygon(point, ring)) return true;
	}
	return false;
};

// ── API pública ──────────────────────────────────────────────────────────

/**
 * Determina la zona de envío de una dirección libre.
 *
 * @returns {Promise<{
 *   zona: 'centro' | 'alejada',
 *   lat: number,
 *   lng: number,
 *   source: 'nominatim' | 'georef' | 'photon',
 *   display: string
 * } | { zona: null, notFound: true } | null>}
 *   - {zona, lat, lng, source, display} si geocodificó y cayó en Coronda.
 *   - {zona: null, notFound: true} si NINGÚN provider devolvió un punto en
 *     el bbox de Coronda → la dirección está fuera del área de cobertura.
 *   - null si la entrada está vacía.
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
	for (const { name, fn } of PROVIDERS) {
		const p = await fn(text);
		if (!p) {
			log('  ', name, 'sin resultado');
			continue;
		}
		log('  ', name, '→', p);
		const zona = isInCentro(p) ? 'centro' : 'alejada';
		const result = { zona, lat: p.lat, lng: p.lng, source: name, display: p.display };
		log('  → zona', zona);
		cache.set(key, result);
		persistCache();
		return result;
	}

	// Fallback: ningún geocoder resolvió. Si reconocemos la calle como una
	// de las del casco céntrico de Coronda, asumimos zona centro sin coords
	// y dejamos pasar el pedido (mejor cobrar centro que rechazar al cliente
	// por un bug del geocoder). Esto cubre calles cortas tipo "España",
	// "Mitre" y similares que OSM/Georef tienen mal indexadas.
	if (matchesKnownCentroStreet(text)) {
		log('fallback por nombre de calle — calle conocida de Coronda centro');
		const result = { zona: 'centro', lat: null, lng: null, source: 'manual', display: text };
		cache.set(key, result);
		persistCache();
		return result;
	}

	log('ningún provider resolvió la dirección — fuera de cobertura');
	// NO cacheamos notFound: puede ser falso negativo transitorio.
	return { zona: null, notFound: true };
};

/** Compat con el shippingZone.js viejo (parser local). Sólo lo dejamos
 *  exportado por si algún módulo lo importa todavía — devuelve 'alejada'
 *  por default si no se llamó al async V2 antes. */
export const determinarZona = () => 'alejada';
