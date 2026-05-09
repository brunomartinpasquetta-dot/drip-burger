import { useState, useEffect, useRef } from 'react';
import pb from '@/lib/pocketbaseClient';
import { determinarZonaV2 } from '@/lib/shippingZoneV2';

const formatShipping = (price) => {
	if (price === 0) {
		return { isFree: true, text: 'Envío gratis 🛵', formattedPrice: '$0,00' };
	}
	const formatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
	return { isFree: false, text: `Envío: ${formatted}`, formattedPrice: formatted };
};

/**
 * Hook async que determina la zona de envío via geocoding + point-in-polygon
 * (cascada Nominatim → Georef → Photon contra el polígono de Coronda
 * centro). Las tarifas siguen viniendo del singleton `settings`.
 *
 * Debounce 800ms para respetar el rate limit de Nominatim (1 req/s).
 *
 * @returns {{
 *   shippingPrice: number,         // tarifa final (0 si fuera de zona o sin direccion)
 *   zona: 'centro'|'alejada'|null, // null = no resolvió o fuera de Coronda
 *   precios: { centro, alejado },  // de settings, para preview en el admin
 *   lat: number|null,
 *   lng: number|null,
 *   loading: boolean,              // true mientras geocodifica
 *   notFound: boolean,             // true si ningún provider resolvió la direccion
 *   formatShipping: (price)=>{...},
 * }}
 */
export const useShippingPrice = (direccion = '') => {
	const [precios, setPrecios] = useState({ centro: 0, alejado: 0 });
	const [zona, setZona] = useState(null);
	const [coords, setCoords] = useState({ lat: null, lng: null });
	const [loadingSettings, setLoadingSettings] = useState(true);
	const [loadingZone, setLoadingZone] = useState(false);
	const [notFound, setNotFound] = useState(false);
	const [error, setError] = useState(null);
	const debounceRef = useRef(null);

	// 1. Cargar tarifas de settings al mount.
	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				setLoadingSettings(true);
				const records = await pb.collection('settings').getList(1, 1, { requestKey: null });
				if (!mounted) return;
				if (records.items.length > 0) {
					const rec = records.items[0];
					const legacy = Number(rec.precio_envio) || 0;
					const centro = rec.precio_envio_centro != null
						? Number(rec.precio_envio_centro) || 0
						: legacy;
					const alejado = rec.precio_envio_alejado != null
						? Number(rec.precio_envio_alejado) || 0
						: legacy;
					setPrecios({ centro, alejado });
				}
			} catch (err) {
				console.error('[useShippingPrice] settings fetch failed:', err);
				if (mounted) setError(err);
			} finally {
				if (mounted) setLoadingSettings(false);
			}
		})();
		return () => { mounted = false; };
	}, []);

	// 2. Cuando cambia la dirección, geocodificar con debounce 800ms.
	useEffect(() => {
		const trimmed = (direccion || '').trim();
		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (!trimmed || trimmed.length < 6) {
			setZona(null);
			setNotFound(false);
			setLoadingZone(false);
			setCoords({ lat: null, lng: null });
			return;
		}

		setLoadingZone(true);
		debounceRef.current = setTimeout(async () => {
			try {
				const result = await determinarZonaV2(trimmed);
				if (!result) {
					// input vacío detectado por la lib
					setZona(null);
					setNotFound(false);
					setCoords({ lat: null, lng: null });
				} else if (result.notFound) {
					setZona(null);
					setNotFound(true);
					setCoords({ lat: null, lng: null });
				} else {
					setZona(result.zona);
					setNotFound(false);
					setCoords({ lat: result.lat, lng: result.lng });
				}
			} catch (err) {
				console.error('[useShippingPrice] zona V2 failed:', err);
				setZona(null);
				setNotFound(false);
			} finally {
				setLoadingZone(false);
			}
		}, 800);

		return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
	}, [direccion]);

	// Tarifa final según zona resuelta.
	const shippingPrice = zona === 'centro'
		? precios.centro
		: zona === 'alejada'
			? precios.alejado
			: 0;

	return {
		shippingPrice,
		zona,
		precios,
		lat: coords.lat,
		lng: coords.lng,
		loading: loadingSettings || loadingZone,
		notFound,
		error,
		formatShipping,
	};
};
