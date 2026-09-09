import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, LocateFixed } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// AddressAutocomplete — input de dirección con dos features OlaClick (portado
// de Sinatra, adaptado a Coronda):
//   1) autocomplete debounced (250ms) contra Nominatim, dropdown con
//      top 5 sugerencias filtradas al área de Coronda;
//   2) botón "Usar mi ubicación actual" que pide geolocation API y
//      reverse-geocodifica para llenar el campo de texto.
//
// El parent recibe el string vía onChange; las coords NO se exponen
// (el zonificador las re-resuelve igual con la cadena resultante para
// asegurar consistencia con el cálculo de zona).
//
// Props:
//   value          string actual del input
//   onChange       (str) => void
//   placeholder    string
//   error          bool — pinta borde rojo
//   className      extra clases para el wrapper
//
// Notas:
//   - Nominatim free tier: 1 req/s. Debounce 250ms + AbortController.
//   - Viewbox idéntico al cascade en shippingZoneV2.js para que las
//     sugerencias matcheen lo que después devuelve el geocoder oficial.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const VIEWBOX = '-60.95,-31.94,-60.88,-32.00';

// OSM trae la localidad en varios niveles redundantes: para Coronda devuelve
// town="Municipio de Coronda" Y municipality="Coronda" como campos separados.
// Saca el prefijo "Municipio de " para quedarnos con el nombre limpio.
const cleanLocality = (s) => String(s || '').replace(/^municipio\s+de\s+/i, '').trim();

// Une segmentos en "a, b, c" descartando vacíos y duplicados case-insensitive
// (evita "Coronda, Coronda" cuando dos campos OSM colapsan al mismo nombre).
const uniqJoin = (parts) => {
	const out = [];
	const seen = new Set();
	for (const p of parts) {
		const t = String(p || '').trim();
		if (!t) continue;
		const k = t.toLowerCase();
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(t);
	}
	return out.join(', ');
};

const fetchSuggestions = async (q, signal) => {
	if (!q || q.trim().length < 3) return [];
	const url = `${NOMINATIM}?q=${encodeURIComponent(q.trim() + ', Coronda, Santa Fe, Argentina')}&format=json&countrycodes=ar&limit=5&viewbox=${VIEWBOX}&bounded=1&addressdetails=1`;
	try {
		const res = await fetch(url, { headers: { 'Accept-Language': 'es' }, signal });
		if (!res.ok) return [];
		const data = await res.json();
		if (!Array.isArray(data)) return [];
		return data.map((d) => {
			const a = d.address || {};
			const calle = a.road || a.pedestrian || a.path || '';
			const altura = a.house_number || '';
			const calleLinea = [calle, altura].filter(Boolean).join(' ');
			// Localidad real (ciudad/pueblo/municipio) limpia. Preferimos esto por
			// sobre el barrio: OSM mapea "Las Rosas" como neighbourhood cubriendo
			// gran parte de Coronda, y mostrarlo como barrio principal confunde.
			const localidad = cleanLocality(a.city || a.town || a.municipality);
			const provincia = a.state || '';

			// short (negrita): "Calle 1234, Coronda". Si no hubiera localidad,
			// recién ahí caemos al barrio/suburb como último recurso.
			const segundo = localidad || cleanLocality(a.suburb || a.neighbourhood || a.city_district);
			const short = uniqJoin([calleLinea, segundo]);

			// full (gris): texto limpio en vez del display_name crudo de Nominatim
			// (que encadena "Las Rosas, Municipio de Coronda, Coronda, ..."):
			// calle+altura, localidad, provincia — sin duplicados.
			const full = uniqJoin([calleLinea, localidad, provincia]);

			return {
				key: d.place_id,
				short: short || d.display_name,
				full: full || d.display_name,
			};
		});
	} catch {
		return []; // network/abort: silent
	}
};

// Reverse geocode — devuelve solo el NOMBRE DE LA CALLE (sin altura).
// Motivo: Nominatim usa interpolación para el house_number entre los
// nodos que tiene mapeados de la manzana, y el resultado suele estar
// desfasado por 5-10 números respecto de la altura real (ej: GPS a
// Juan de Garay 1696 devuelve "1702"). Es más confiable tomar solo la
// calle y que el cliente escriba la altura a mano (él la sabe mejor).
//
// Devuelve { street, hasStreet } donde hasStreet es true SOLO si Nominatim
// resolvió una calle real. Si no, no hay nada utilizable.
const reverseGeocode = async (lat, lng) => {
	const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
	try {
		const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
		if (!res.ok) return { street: null, hasStreet: false };
		const d = await res.json();
		const a = d?.address || {};
		const calle = a.road || a.pedestrian || a.path || '';
		if (!calle) return { street: null, hasStreet: false };
		return { street: calle, hasStreet: true };
	} catch { return { street: null, hasStreet: false }; }
};

const AddressAutocomplete = ({ value, onChange, onCoords, placeholder, error, className, hideMyLocation = false }) => {
	const [suggestions, setSuggestions] = useState([]);
	const [open, setOpen] = useState(false);
	const [loadingSug, setLoadingSug] = useState(false);
	const [loadingGeo, setLoadingGeo] = useState(false);
	const debounceRef = useRef(null);
	const abortRef = useRef(null);
	const wrapperRef = useRef(null);

	// Debounce input → fetch sugerencias.
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (abortRef.current) abortRef.current.abort();
		const q = (value || '').trim();
		if (q.length < 3) {
			setSuggestions([]);
			setLoadingSug(false);
			return;
		}
		setLoadingSug(true);
		debounceRef.current = setTimeout(async () => {
			const ctrl = new AbortController();
			abortRef.current = ctrl;
			const list = await fetchSuggestions(q, ctrl.signal);
			setSuggestions(list);
			setLoadingSug(false);
		}, 250);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [value]);

	// Cerrar dropdown al click afuera.
	useEffect(() => {
		const onClickOutside = (e) => {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', onClickOutside);
		return () => document.removeEventListener('mousedown', onClickOutside);
	}, []);

	const handleSelectSuggestion = (s) => {
		onChange(s.short);
		setOpen(false);
	};

	const handleUseMyLocation = () => {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			alert('Tu navegador no soporta geolocalización.');
			return;
		}
		setLoadingGeo(true);
		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const { latitude: lat, longitude: lng, accuracy } = pos.coords;
				setLoadingGeo(false);

				// Gate 1: precisión pobre → no llenamos nada, avisamos y
				// el cliente tipea a mano. 150m es el corte razonable
				// (GPS puro suele estar en 5-30m; WiFi cae en 30-100m;
				// IP-based supera fácil los 500m).
				if (Number.isFinite(accuracy) && accuracy > 150) {
					alert(`Tu GPS marca poca precisión (±${Math.round(accuracy)}m). No pudimos detectar tu dirección — escribila a mano así el repartidor sabe adónde ir.`);
					setOpen(false);
					return;
				}

				const { street, hasStreet } = await reverseGeocode(lat, lng);

				// Gate 2: reverse-geocode no devolvió una calle real →
				// NO llenamos el input con "Municipio de Coronda, ..." ni
				// pasamos coords al parent. Si el input queda vacío, el
				// pre-flight del checkout bloquea el submit y el cliente
				// se ve forzado a tipear una dirección real.
				if (!hasStreet) {
					alert('El GPS no encontró tu dirección exacta. Escribí calle y altura a mano — el repartidor la necesita para llegar.');
					setOpen(false);
					return;
				}

				// OK: calle resuelta. NO usamos la altura de Nominatim
				// (viene interpolada y suele estar 5-10 números off).
				// Llenamos con "<calle> " (espacio final como hint) y le
				// pedimos al cliente que agregue el número. NO pasamos
				// coords al parent — la zonificación se hará re-geocodificando
				// el texto final (con altura real), no las coords GPS.
				onChange(`${street} `);
				setOpen(false);
				setTimeout(() => {
					alert(`Detecté "${street}" pero el número puede no ser exacto. Completá la altura de tu casa a mano.`);
				}, 100);
			},
			(err) => {
				setLoadingGeo(false);
				// Códigos: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
				const reason = err?.code === 1
					? 'permiso denegado'
					: err?.code === 3 ? 'tiempo agotado' : 'no disponible';
				alert(`No pude obtener tu ubicación (${reason}). Probá tipear la dirección.`);
			},
			// maximumAge: 0 fuerza un lookup fresco. Sin esto, el browser
			// puede devolver una posición cacheada de hace minutos/horas
			// (puede ser de otra red si el usuario cambió de WiFi).
			{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
		);
	};

	const showDropdown = open && (loadingSug || suggestions.length > 0);

	return (
		<div ref={wrapperRef} className={cn('relative', className)}>
			<div className="flex gap-1.5">
				<Input
					value={value}
					onChange={(e) => { onChange(e.target.value); setOpen(true); }}
					onFocus={() => setOpen(true)}
					placeholder={placeholder}
					className={cn(
						'bg-background border-border text-foreground focus-visible:ring-1 flex-1',
						error && 'border-destructive bg-destructive/10 focus-visible:ring-destructive',
					)}
				/>
				{!hideMyLocation && (
					<button
						type="button"
						onClick={handleUseMyLocation}
						disabled={loadingGeo}
						title="Usar mi ubicación actual"
						className="shrink-0 h-10 px-3 rounded-md border border-border bg-background hover:bg-muted/20 text-foreground transition-colors flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider disabled:opacity-50"
					>
						{loadingGeo
							? <Loader2 className="w-4 h-4 animate-spin" />
							: <LocateFixed className="w-4 h-4" />}
						<span className="hidden sm:inline">Mi ubicación</span>
					</button>
				)}
			</div>
			{showDropdown && (
				<div className="absolute z-30 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden max-h-72 overflow-y-auto">
					{loadingSug && (
						<div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
							<Loader2 className="w-3 h-3 animate-spin" />
							Buscando…
						</div>
					)}
					{!loadingSug && suggestions.map((s) => (
						<button
							key={s.key}
							type="button"
							onMouseDown={(e) => e.preventDefault()} // evita blur antes del click
							onClick={() => handleSelectSuggestion(s)}
							className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/20 border-b border-border last:border-b-0"
						>
							<MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
							<div className="flex-1 min-w-0">
								<div className="text-xs font-bold text-foreground truncate">{s.short}</div>
								{s.full && s.full !== s.short && (
									<div className="text-[10px] text-muted-foreground truncate">{s.full}</div>
								)}
							</div>
						</button>
					))}
					{!loadingSug && suggestions.length === 0 && (
						<div className="px-3 py-2 text-[11px] text-muted-foreground italic">
							Sin sugerencias. Seguí escribiendo o tocá 📍 Mi ubicación.
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default AddressAutocomplete;
