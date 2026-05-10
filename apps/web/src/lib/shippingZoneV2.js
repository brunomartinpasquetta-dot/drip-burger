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

// Viewbox EXACTO del standalone zonificador-coronda-v4.html (const BBOX).
// REGLA: paridad 1:1 con el standalone — cualquier desvío hace que Nominatim
// devuelva coords distintas y la app diverja del HTML de referencia que el
// negocio usó para dibujar el polígono. NO aproximar este valor.
// Formato Nominatim viewbox: minLng,maxLat,maxLng,minLat
const NOMINATIM_VIEWBOX = '-60.95,-31.94,-60.88,-32.00';

// bbox para post-filter — DERIVADO del viewbox de arriba (mismo rectángulo).
// El standalone confía en bounded=1 (Nominatim no devuelve nada fuera del
// viewbox); replicamos eso acá descartando cualquier coord fuera.
const CORONDA_BBOX = { minLng: -60.95, minLat: -32.00, maxLng: -60.88, maxLat: -31.94 };

// v3: bump tras (a) corregir el viewbox al del standalone y (b) sacar el
// fallback por nombre de calle que validaba alturas inexistentes. Invalida
// entries stale del localStorage de los clientes.
const CACHE_KEY = 'dripburger:geocode:v3';
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

// NOTA: NO hay fallback por nombre de calle. Se intentó (commit 86b0d03) pero
// ignoraba la altura → "España 3000" (altura inexistente) caía como centro.
// El standalone tampoco tiene fallback: si Nominatim no encuentra la
// dirección, es "no encontrada". Con el viewbox correcto (paridad con el
// HTML) Nominatim resuelve bien las direcciones reales de Coronda; si no la
// encuentra, probablemente no existe → fuera de cobertura, bloquea el submit.

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

	log('ningún provider resolvió la dirección — fuera de cobertura');
	// NO cacheamos notFound: puede ser falso negativo transitorio (provider
	// caído, rate limit). Reintentar la próxima vez sale barato.
	return { zona: null, notFound: true };
};

/** Compat con el shippingZone.js viejo (parser local). Sólo lo dejamos
 *  exportado por si algún módulo lo importa todavía — devuelve 'alejada'
 *  por default si no se llamó al async V2 antes. */
export const determinarZona = () => 'alejada';
