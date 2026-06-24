// Helper liviano para calcular distancia entre dos puntos lat/lng.
// Usado en admin (chip "X.X km" al lado de cada pedido) y en el mapa.
// Sin dependencias, sin side-effects.

export const haversineKm = (a, b) => {
	if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) ||
		!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return null;
	const R = 6371; // radio Tierra en km
	const toRad = (x) => (x * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const s1 = Math.sin(dLat / 2);
	const s2 = Math.sin(dLng / 2);
	const c = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
	return 2 * R * Math.asin(Math.sqrt(c));
};

// "1.2 km" / "850 m" — formato compacto para chips de UI.
export const formatDistance = (km) => {
	if (!Number.isFinite(km)) return '—';
	if (km < 1) return `${Math.round(km * 1000)} m`;
	return `${km.toFixed(km < 10 ? 1 : 0)} km`;
};
