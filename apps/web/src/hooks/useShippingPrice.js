import { useState, useEffect, useRef } from 'react';
import { determinarZonaV2, determinarZonaDesdeCoords } from '@/lib/shippingZoneV2';

const formatShipping = (price) => {
	if (price === 0) {
		return { isFree: true, text: 'Envío gratis 🛵', formattedPrice: '$0,00' };
	}
	const formatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
	return { isFree: false, text: `Envío: ${formatted}`, formattedPrice: formatted };
};

/**
 * Hook async (portado de Sinatra) — geocodifica + determina zona via GeoJSON
 * o calcula tarifa por modo (zonas|distancia|fijo). Debounce 800ms para
 * respetar rate limit Nominatim (1 req/s).
 *
 * @returns {
 *   shippingPrice: number,         // tarifa final (0 si fuera de zona o sin direccion)
 *   zonaId: string | null,
 *   zonaNombre: string,
 *   zonaColor: string,             // hex
 *   zona: 'centro'|'alejada'|null, // alias legacy (compat con CartPage viejo)
 *   precios: null,                 // compat — la tarifa viene del geojson ahora
 *   lat: number | null,
 *   lng: number | null,
 *   loading: bool,
 *   outOfZone: bool,               // geocodificó pero no hay zona
 *   notFound: bool,                // ningún provider resolvió la dirección
 *   error: Error | null,
 *   formatShipping: (price)=>{ isFree, text, formattedPrice }
 * }
 */
export const useShippingPrice = (direccion = '', overrideCoords = null) => {
	const [shippingPrice, setShippingPrice] = useState(0);
	const [zonaId, setZonaId] = useState(null);
	const [zonaNombre, setZonaNombre] = useState('');
	const [zonaColor, setZonaColor] = useState('#F5A800');
	const [coords, setCoords] = useState({ lat: null, lng: null });
	const [loading, setLoading] = useState(false);
	const [outOfZone, setOutOfZone] = useState(false);
	const [notFound, setNotFound] = useState(false);
	const debounceRef = useRef(null);

	// Path corto: cuando viene `overrideCoords` (cliente usó "Mi ubicación"),
	// resolvemos la zona directamente con esos coords sin pasar por el
	// geocoder. Más preciso — el browser ya tiene la lat/lng del GPS/WiFi,
	// re-geocodificar la dirección aproximada introduce drift.
	useEffect(() => {
		if (!overrideCoords || !Number.isFinite(overrideCoords.lat) || !Number.isFinite(overrideCoords.lng)) return;
		const result = determinarZonaDesdeCoords(overrideCoords);
		if (!result) {
			setNotFound(true); setOutOfZone(false); setZonaId(null); setZonaNombre('');
			setShippingPrice(0); setCoords({ lat: null, lng: null });
		} else if (result.zonaId === null) {
			setNotFound(false); setOutOfZone(true); setZonaId(null);
			setZonaNombre(result.zonaNombre); setZonaColor(result.color);
			setShippingPrice(0); setCoords({ lat: result.lat, lng: result.lng });
		} else {
			setNotFound(false); setOutOfZone(false);
			setZonaId(result.zonaId); setZonaNombre(result.zonaNombre); setZonaColor(result.color);
			setShippingPrice(result.tarifa); setCoords({ lat: result.lat, lng: result.lng });
		}
		setLoading(false);
	}, [overrideCoords?.lat, overrideCoords?.lng]);

	useEffect(() => {
		// Si hay overrideCoords activos, el otro effect se encarga.
		if (overrideCoords && Number.isFinite(overrideCoords.lat) && Number.isFinite(overrideCoords.lng)) return;
		const trimmed = (direccion || '').trim();
		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (!trimmed || trimmed.length < 6) {
			setShippingPrice(0);
			setZonaId(null);
			setZonaNombre('');
			setOutOfZone(false);
			setNotFound(false);
			setLoading(false);
			return;
		}

		setLoading(true);
		debounceRef.current = setTimeout(async () => {
			const result = await determinarZonaV2(trimmed);
			if (!result) {
				setNotFound(true);
				setOutOfZone(false);
				setZonaId(null);
				setZonaNombre('');
				setShippingPrice(0);
				setCoords({ lat: null, lng: null });
			} else if (result.zonaId === null) {
				setNotFound(false);
				setOutOfZone(true);
				setZonaId(null);
				setZonaNombre(result.zonaNombre);
				setZonaColor(result.color);
				setShippingPrice(0);
				setCoords({ lat: result.lat, lng: result.lng });
			} else {
				setNotFound(false);
				setOutOfZone(false);
				setZonaId(result.zonaId);
				setZonaNombre(result.zonaNombre);
				setZonaColor(result.color);
				setShippingPrice(result.tarifa);
				setCoords({ lat: result.lat, lng: result.lng });
			}
			setLoading(false);
		}, 800);

		return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
	}, [direccion, overrideCoords?.lat, overrideCoords?.lng]);

	// Alias legacy `zona`: 'centro' para zonas que sean CENTRO/Z1/Z2/Z5 (cerca),
	// 'alejada' para el resto. Compat con CartPage / código viejo que decide
	// según ese string.
	const zonaLegacy = zonaId
		? (/^(CENTRO|Z1|Z2|Z5|FIJO|DIST)$/i.test(zonaId) ? 'centro' : 'alejada')
		: null;

	return {
		shippingPrice,
		zonaId,
		zonaNombre,
		zonaColor,
		zona: zonaLegacy,
		precios: null, // ya no se usa — la tarifa viene del geojson
		lat: coords.lat,
		lng: coords.lng,
		loading,
		outOfZone,
		notFound,
		error: null,
		formatShipping,
	};
};
