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

const fetchSuggestions = async (q, signal) => {
	if (!q || q.trim().length < 3) return [];
	const url = `${NOMINATIM}?q=${encodeURIComponent(q.trim() + ', Coronda, Santa Fe, Argentina')}&format=json&countrycodes=ar&limit=5&viewbox=${VIEWBOX}&bounded=1&addressdetails=1`;
	try {
		const res = await fetch(url, { headers: { 'Accept-Language': 'es' }, signal });
		if (!res.ok) return [];
		const data = await res.json();
		if (!Array.isArray(data)) return [];
		return data.map((d) => {
			// Etiqueta corta "Calle 1234, Barrio" (más legible que el display_name).
			const a = d.address || {};
			const calle = a.road || a.pedestrian || a.path || '';
			const altura = a.house_number || '';
			const barrio = a.suburb || a.neighbourhood || a.city_district || a.town || a.city || '';
			const short = [
				[calle, altura].filter(Boolean).join(' '),
				barrio,
			].filter(Boolean).join(', ');
			return {
				key: d.place_id,
				short: short || d.display_name,
				full: d.display_name,
			};
		});
	} catch {
		return []; // network/abort: silent
	}
};

const reverseGeocode = async (lat, lng) => {
	const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
	try {
		const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
		if (!res.ok) return null;
		const d = await res.json();
		const a = d?.address || {};
		const calle = a.road || a.pedestrian || a.path || '';
		const altura = a.house_number || '';
		const linea = [calle, altura].filter(Boolean).join(' ');
		return linea || d?.display_name || `${lat.toFixed(5)},${lng.toFixed(5)}`;
	} catch { return null; }
};

const AddressAutocomplete = ({ value, onChange, onCoords, placeholder, error, className }) => {
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
				// Pasamos las coords EXACTAS al parent — el zonificador las
				// usa directo sin pasar por el geocoder lossy.
				if (typeof onCoords === 'function') onCoords({ lat, lng, accuracy });
				const addr = await reverseGeocode(lat, lng);
				if (addr) onChange(addr);
				else onChange(`Ubicación aprox. (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
				setLoadingGeo(false);
				setOpen(false);
				// Si la precisión es pobre (>500m) avisar al cliente para que
				// edite/verifique. En desktop sin GPS suele ser >1000m via IP.
				if (Number.isFinite(accuracy) && accuracy > 500) {
					setTimeout(() => {
						alert(`Te detecté con poca precisión (±${Math.round(accuracy)}m). Verificá la dirección o corregila a mano.`);
					}, 100);
				}
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
