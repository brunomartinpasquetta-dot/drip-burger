import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import '@geoman-io/leaflet-geoman-free';
import pb from '@/lib/pocketbaseClient';
import { loadZonas } from '@/lib/zonasLoader';
import { loadLocalCenter, getLocalCenter } from '@/lib/localCenterLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Trash2, MapPin, Eye, EyeOff, Plus, Edit3, X, Check, Home, Search, Target, Route, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const LOCAL_ICON = L.divIcon({
	className: '',
	iconSize: [32, 32],
	iconAnchor: [16, 16],
	html: '<div style="width:32px;height:32px;background:#0a0a0a;border:3px solid #db9643;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#db9643;font-weight:900;font-family:sans-serif;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.5)">●</div>',
});

const DEFAULT_CENTER = [-31.9731, -60.9205]; // Coronda — Juan de Garay 2189

// Subcomponente para la fila editable de una zona circular. Mantiene STATE
// LOCAL del nombre/radio/tarifa para que el input no quede congelado mientras
// el parent debouncea el PB.update (sin esto el cursor "salta" en cada letra
// porque el value vuelve a ser z.nombre hasta que loadZonas() rehidrata).
const ZonaCirculoRow = ({ z, onUpdate, onDelete }) => {
	const [nombre, setNombre] = useState(z.nombre || '');
	const [radio, setRadio] = useState(String(z.radio_km || 0));
	const [tarifa, setTarifa] = useState(String(z.tarifa || 0));

	// Si la zona se rehidrata desde PB (ej. realtime sub trajo cambio
	// externo), sincronizar local state — pero sólo si el campo no está
	// siendo editado (heurística: si el valor local matchea o el remoto
	// difiere significativamente). Para simplicidad sincronizamos siempre,
	// el debounce evita race conditions porque el último save gana.
	useEffect(() => { setNombre(z.nombre || ''); }, [z.nombre]);
	useEffect(() => { setRadio(String(z.radio_km || 0)); }, [z.radio_km]);
	useEffect(() => { setTarifa(String(z.tarifa || 0)); }, [z.tarifa]);

	return (
		<div className="px-3 py-2 space-y-1 text-xs">
			<div className="flex items-center gap-2">
				<input
					type="color"
					value={z.color}
					onChange={(e) => onUpdate(z, { color: e.target.value })}
					className="w-6 h-6 rounded border border-border bg-background cursor-pointer"
				/>
				<Input
					value={nombre}
					onChange={(e) => {
						const v = e.target.value.slice(0, 60);
						setNombre(v);
						onUpdate(z, { nombre: v });
					}}
					className="flex-1 bg-background border-border h-7 text-xs font-bold"
				/>
				<button
					onClick={() => onUpdate(z, { activa: !z.activa })}
					className="text-muted-foreground hover:text-foreground"
					title={z.activa === false ? 'Activar' : 'Desactivar'}
				>
					{z.activa === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
				</button>
				<button
					onClick={() => onDelete(z)}
					className="text-red-400 hover:text-red-500"
					title="Eliminar zona"
				>
					<Trash2 className="w-3.5 h-3.5" />
				</button>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-[10px] text-muted-foreground font-bold uppercase shrink-0 w-12">Hasta</span>
				<Input
					type="number"
					min="0.1" step="0.1"
					value={radio}
					onChange={(e) => {
						setRadio(e.target.value);
						onUpdate(z, { radio_km: Math.max(0, Number(e.target.value) || 0) });
					}}
					className="w-20 bg-background border-border h-7 text-xs font-black tabular-nums"
				/>
				<span className="text-[10px] font-bold text-muted-foreground">km</span>
				<span className="text-[10px] text-muted-foreground font-bold uppercase shrink-0 ml-2">$</span>
				<Input
					type="number"
					min="0" step="100"
					value={tarifa}
					onChange={(e) => {
						setTarifa(e.target.value);
						onUpdate(z, { tarifa: Math.max(0, Number(e.target.value) || 0) });
					}}
					className="flex-1 bg-background border-border h-7 text-xs font-black tabular-nums"
				/>
			</div>
		</div>
	);
};

// ═════════════════════════════════════════════════════════════════
// MODO OLACLICK — zonas por distancia (círculos)
// ═════════════════════════════════════════════════════════════════
const ZonasPorDistancia = ({ zonas, onChanged }) => {
	const containerRef = useRef(null);
	const mapRef = useRef(null);
	const layersRef = useRef([]);
	const [localCenter, setLocalCenter] = useState(() => getLocalCenter());
	const [localAddress, setLocalAddress] = useState('');
	const [geocoding, setGeocoding] = useState(false);
	const [savingCenter, setSavingCenter] = useState(false);

	const circulos = zonas.filter((z) => z.tipo === 'circulo').sort((a, b) => Number(a.radio_km) - Number(b.radio_km));

	// Init mapa + repintar al cambiar zonas/centro.
	useEffect(() => {
		if (!containerRef.current || mapRef.current) return;
		const center = getLocalCenter();
		const start = Number.isFinite(center.lat) ? [center.lat, center.lng] : DEFAULT_CENTER;
		const map = L.map(containerRef.current, { center: start, zoom: 12, zoomControl: true });
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap', maxZoom: 19,
		}).addTo(map);
		mapRef.current = map;
		return () => { map.remove(); mapRef.current = null; };
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		for (const l of layersRef.current) try { map.removeLayer(l); } catch {}
		layersRef.current = [];
		const center = localCenter;
		if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;
		// Marker del local
		const marker = L.marker([center.lat, center.lng], { icon: LOCAL_ICON, draggable: true })
			.addTo(map);
		marker.on('dragend', () => {
			const ll = marker.getLatLng();
			setLocalCenter({ lat: ll.lat, lng: ll.lng });
		});
		layersRef.current.push(marker);
		// Círculos concéntricos
		for (const z of circulos) {
			if (z.activa === false) continue;
			const c = L.circle([center.lat, center.lng], {
				radius: Number(z.radio_km) * 1000,
				color: z.color,
				weight: 2,
				opacity: 0.9,
				fillColor: z.color,
				fillOpacity: 0.10,
			}).bindTooltip(`<strong>${z.nombre}</strong><br/>Envío $${Number(z.tarifa).toLocaleString('es-AR')}`, { sticky: true });
			c.addTo(map);
			layersRef.current.push(c);
		}
		// Centrar y zoom para que entren todos los círculos
		if (circulos.length > 0) {
			const maxKm = Math.max(...circulos.map((z) => Number(z.radio_km)));
			const bbox = L.latLng(center.lat, center.lng).toBounds(maxKm * 1000 * 1.5);
			try { map.fitBounds(bbox); } catch {}
		} else {
			map.setView([center.lat, center.lng], 13);
		}
	}, [circulos, localCenter]);

	const handleGeocode = async () => {
		if (!localAddress.trim()) return;
		setGeocoding(true);
		try {
			const p = new URLSearchParams({ direccion: localAddress, provincia: 'santa fe', max: '3' });
			const res = await fetch('https://apis.datos.gob.ar/georef/api/direcciones?' + p);
			const data = await res.json();
			const first = (data.direcciones || [])[0];
			if (!first?.ubicacion) {
				toast.error('No encontré esa dirección');
				return;
			}
			setLocalCenter({ lat: first.ubicacion.lat, lng: first.ubicacion.lon });
			toast.success(`Local en: ${first.nomenclatura}`);
		} catch (err) {
			toast.error('Error en geocoder: ' + (err.message || err));
		} finally {
			setGeocoding(false);
		}
	};

	const handleSaveCenter = async () => {
		setSavingCenter(true);
		try {
			const recs = await pb.collection('settings').getList(1, 1, { requestKey: null });
			if (recs.items.length === 0) throw new Error('No hay record de settings');
			await pb.collection('settings').update(recs.items[0].id, {
				local_lat: localCenter.lat, local_lng: localCenter.lng,
			}, { requestKey: null });
			loadLocalCenter();
			toast.success('Ubicación del local guardada');
		} catch (err) {
			toast.error('Error al guardar: ' + (err?.message || 'sin status'));
		} finally {
			setSavingCenter(false);
		}
	};

	const handleAddZone = async () => {
		const lastKm = circulos.length > 0 ? Number(circulos[circulos.length - 1].radio_km) : 0;
		const km = window.prompt('Hasta cuántos km llega esta zona?', String(lastKm + 2));
		if (km === null) return;
		const tarifa = window.prompt('Tarifa de envío en pesos:', '3000');
		if (tarifa === null) return;
		const palette = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
		try {
			await pb.collection('zonas_delivery').create({
				zona_id: `C${Date.now().toString(36).slice(-4).toUpperCase()}`,
				nombre: `Hasta ${km} km`,
				color: palette[circulos.length % palette.length],
				tarifa: Math.max(0, Number(tarifa) || 0),
				radio_km: Math.max(0.1, Number(km) || 1),
				orden: circulos.length + 1,
				tipo: 'circulo',
				activa: true,
			}, { requestKey: null });
			loadZonas();
			onChanged?.();
			toast.success('Zona agregada');
		} catch (err) {
			toast.error('Error al crear: ' + (err?.message || ''));
		}
	};

	// Patches pendientes por zona — se mergean y se mandan con debounce 400ms.
	// Sin esto, cada keystroke en "nombre" disparaba un PB.update + loadZonas()
	// → input lagueaba feo (cada letra esperaba round-trip al server).
	const pendingPatchRef = useRef(new Map()); // zoneId -> patch acumulado
	const debounceRef = useRef(new Map());     // zoneId -> timeoutId
	const handleUpdateZone = (z, patch) => {
		const id = z.id;
		const merged = { ...(pendingPatchRef.current.get(id) || {}), ...patch };
		pendingPatchRef.current.set(id, merged);
		const prevTimer = debounceRef.current.get(id);
		if (prevTimer) clearTimeout(prevTimer);
		const timer = setTimeout(async () => {
			const finalPatch = pendingPatchRef.current.get(id) || {};
			pendingPatchRef.current.delete(id);
			debounceRef.current.delete(id);
			try {
				await pb.collection('zonas_delivery').update(id, finalPatch, { requestKey: null });
				loadZonas();
				onChanged?.();
			} catch (err) {
				toast.error('Error al actualizar');
			}
		}, 400);
		debounceRef.current.set(id, timer);
	};

	const handleDeleteZone = async (z) => {
		if (!window.confirm(`¿Borrar la zona "${z.nombre}"?`)) return;
		try {
			await pb.collection('zonas_delivery').delete(z.id, { requestKey: null });
			loadZonas();
			onChanged?.();
			toast.success('Zona eliminada');
		} catch (err) {
			toast.error('Error al eliminar');
		}
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
			{/* Mapa */}
			<div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
				<div className="px-3 py-2 bg-muted/20 border-b border-border flex items-center justify-between gap-2 flex-wrap">
					<p className="text-[10px] font-bold text-muted-foreground">
						<Home className="inline w-3 h-3 mr-1" />
						Arrastrá el pin negro para mover el local. Las zonas son círculos concéntricos.
					</p>
				</div>
				<div ref={containerRef} className="w-full" style={{ height: 480, zIndex: 0 }} />
			</div>

			{/* Sidebar */}
			<div className="space-y-3">
				{/* Centro del local */}
				<div className="bg-card border border-border rounded-xl p-3 space-y-2">
					<p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
						<Target className="inline w-3 h-3 mr-1" />Ubicación del local
					</p>
					<div className="flex gap-1.5">
						<Input
							placeholder="Juan de Garay 2189, Coronda"
							value={localAddress}
							onChange={(e) => setLocalAddress(e.target.value)}
							className="bg-background border-border h-8 text-xs font-bold flex-1"
							onKeyDown={(e) => { if (e.key === 'Enter') handleGeocode(); }}
						/>
						<Button
							onClick={handleGeocode}
							disabled={geocoding || !localAddress.trim()}
							size="sm"
							variant="outline"
							className="h-8 px-2 text-[10px] font-bold border-border"
						>
							{geocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
						</Button>
					</div>
					<div className="text-[10px] text-muted-foreground tabular-nums font-bold">
						lat {localCenter.lat?.toFixed?.(4)} · lng {localCenter.lng?.toFixed?.(4)}
					</div>
					<Button
						onClick={handleSaveCenter}
						disabled={savingCenter}
						size="sm"
						className="btn-primary w-full h-8 text-[11px] font-black uppercase tracking-wide"
					>
						{savingCenter ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="mr-1 h-3 w-3" />Guardar ubicación</>}
					</Button>
				</div>

				{/* Lista de zonas (rangos km) */}
				<div className="bg-card border border-border rounded-xl overflow-hidden">
					<div className="px-3 py-2 bg-muted/20 border-b border-border flex items-center justify-between">
						<p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rangos ({circulos.length})</p>
						<Button onClick={handleAddZone} size="sm" className="btn-primary h-6 px-2 text-[10px] font-black uppercase">
							<Plus className="mr-0.5 h-3 w-3" />Agregar
						</Button>
					</div>
					<div className="divide-y divide-border max-h-96 overflow-y-auto">
						{circulos.length === 0 && (
							<p className="px-3 py-6 text-center text-xs text-muted-foreground font-bold">
								No hay rangos. Tocá "Agregar".
							</p>
						)}
						{circulos.map((z) => (
							<ZonaCirculoRow
								key={z.id}
								z={z}
								onUpdate={handleUpdateZone}
								onDelete={handleDeleteZone}
							/>
						))}
					</div>
				</div>
				<p className="text-[10px] text-muted-foreground italic">
					💡 Las zonas se ordenan por radio. Cuando el cliente tipea una dirección, se mide la distancia desde el local y se asigna la zona del menor radio que la contenga. Si supera el radio más grande → "fuera de zona".
				</p>
			</div>
		</div>
	);
};

// ═════════════════════════════════════════════════════════════════
// MODO AVANZADO — polígonos con geoman
// ═════════════════════════════════════════════════════════════════
const ZonasPorPoligono = ({ zonas, onChanged }) => {
	const containerRef = useRef(null);
	const mapRef = useRef(null);
	const layersByIdRef = useRef(new Map());
	const [selectedId, setSelectedId] = useState(null);
	const [form, setForm] = useState({ nombre: '', color: '#db9643', tarifa: 0, activa: true });
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [editingPolygonId, setEditingPolygonId] = useState(null);
	const [drawing, setDrawing] = useState(false);
	const [newZonePoly, setNewZonePoly] = useState(null);

	const poligonos = zonas.filter((z) => z.tipo !== 'circulo');

	useEffect(() => {
		const z = poligonos.find((r) => r.id === selectedId);
		if (z) setForm({ nombre: z.nombre || '', color: z.color || '#db9643', tarifa: Number(z.tarifa) || 0, activa: z.activa !== false });
	}, [selectedId, zonas]);

	useEffect(() => {
		if (!containerRef.current || mapRef.current) return;
		const map = L.map(containerRef.current, { center: DEFAULT_CENTER, zoom: 12, zoomControl: true });
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
		map.pm.addControls({ position: 'topright', drawCircle: false, drawCircleMarker: false, drawPolyline: false, drawRectangle: false, drawMarker: false, drawText: false, editMode: false, dragMode: false, cutPolygon: false, removalMode: false, rotateMode: false });
		map.pm.setGlobalOptions({ allowSelfIntersection: false });
		map.on('pm:create', (e) => {
			try {
				const latlngs = e.layer.getLatLngs()[0];
				const coords = latlngs.map((p) => [p.lng, p.lat]);
				setNewZonePoly(coords);
				map.removeLayer(e.layer);
			} catch (err) { console.error(err); }
		});
		mapRef.current = map;
		return () => { map.remove(); mapRef.current = null; };
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		if (editingPolygonId) return;
		for (const l of layersByIdRef.current.values()) try { map.removeLayer(l); } catch {}
		layersByIdRef.current.clear();
		for (const z of poligonos) {
			const coords = Array.isArray(z.coords) ? z.coords : [];
			if (coords.length < 3) continue;
			const latlngs = coords.map(([lng, lat]) => [lat, lng]);
			const isActive = z.id === selectedId;
			const isInactive = z.activa === false;
			const layer = L.polygon(latlngs, {
				color: z.color, weight: isActive ? 4 : 2,
				opacity: isInactive ? 0.4 : (isActive ? 1 : 0.8),
				fillColor: z.color, fillOpacity: isInactive ? 0.05 : (isActive ? 0.35 : 0.15),
				dashArray: isInactive ? '6,6' : null,
			}).bindTooltip(`<strong>${z.nombre}</strong>${isInactive ? ' (inactiva)' : ''}`, { sticky: true });
			layer.on('click', () => setSelectedId(z.id));
			layer.addTo(map);
			layersByIdRef.current.set(z.id, layer);
		}
	}, [poligonos, selectedId, editingPolygonId]);

	const handleSave = async () => {
		if (!selectedId) return;
		setSaving(true);
		try {
			await pb.collection('zonas_delivery').update(selectedId, {
				nombre: form.nombre.trim(), color: form.color,
				tarifa: Math.max(0, Number(form.tarifa) || 0), activa: !!form.activa,
			}, { requestKey: null });
			loadZonas(); onChanged?.();
			toast.success('Zona actualizada');
		} catch (err) { toast.error('Error al guardar'); }
		finally { setSaving(false); }
	};
	const handleDelete = async () => {
		if (!selectedId) return;
		const z = poligonos.find((r) => r.id === selectedId);
		if (!z || !window.confirm(`¿Borrar la zona "${z.nombre}"?`)) return;
		setDeleting(true);
		try {
			await pb.collection('zonas_delivery').delete(selectedId, { requestKey: null });
			loadZonas(); onChanged?.(); setSelectedId(null);
			toast.success('Zona eliminada');
		} catch (err) { toast.error('Error al eliminar'); }
		finally { setDeleting(false); }
	};
	const handleEditPolygon = () => {
		if (!selectedId) return;
		const layer = layersByIdRef.current.get(selectedId);
		if (!layer) return;
		if (editingPolygonId === selectedId) {
			try { layer.pm?.disable(); } catch {}
			setEditingPolygonId(null);
		} else {
			try {
				layer.pm.enable({ allowSelfIntersection: false, snappable: true, snapDistance: 18 });
				setEditingPolygonId(selectedId);
				toast.info('Arrastrá los puntos amarillos. Luego "Guardar polígono".');
			} catch (err) { toast.error('No pude habilitar la edición'); }
		}
	};
	const handleSavePolygon = async () => {
		if (!editingPolygonId) return;
		const layer = layersByIdRef.current.get(editingPolygonId);
		if (!layer) return;
		try {
			const coords = layer.getLatLngs()[0].map((p) => [p.lng, p.lat]);
			if (coords.length < 3) { toast.error('Polígono inválido'); return; }
			await pb.collection('zonas_delivery').update(editingPolygonId, { coords }, { requestKey: null });
			try { layer.pm.disable(); } catch {}
			setEditingPolygonId(null); loadZonas(); onChanged?.();
			toast.success('Polígono actualizado');
		} catch (err) { toast.error('Error al guardar polígono'); }
	};
	const handleStartDraw = () => {
		const map = mapRef.current; if (!map) return;
		try {
			map.pm.enableDraw('Polygon', { allowSelfIntersection: false, snappable: true, snapDistance: 18, finishOn: 'dblclick' });
			setDrawing(true); setSelectedId(null);
			toast.info('Click para vertices, doble-click para cerrar.');
		} catch (err) { toast.error('No pude activar el dibujo'); }
	};
	const handleCancelDraw = () => {
		const map = mapRef.current; if (map) try { map.pm.disableDraw(); } catch {}
		setDrawing(false); setNewZonePoly(null);
	};
	const handleSaveNewZone = async () => {
		if (!newZonePoly || newZonePoly.length < 3) return;
		const nombre = window.prompt('Nombre:', 'Nueva zona'); if (!nombre) return;
		const tarifaStr = window.prompt('Tarifa:', '3000'); if (tarifaStr === null) return;
		try {
			await pb.collection('zonas_delivery').create({
				zona_id: `P${Date.now().toString(36).slice(-3).toUpperCase()}`,
				nombre: nombre.trim().slice(0, 60), color: '#db9643',
				tarifa: Math.max(0, Number(tarifaStr) || 0), orden: poligonos.length, tipo: 'poligono',
				activa: true, coords: newZonePoly,
			}, { requestKey: null });
			setDrawing(false); setNewZonePoly(null); loadZonas(); onChanged?.();
			toast.success('Zona creada');
		} catch (err) { toast.error('Error al crear'); }
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
			<div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
				<div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/20 border-b border-border flex-wrap">
					<p className="text-[10px] font-bold text-muted-foreground">
						<MapPin className="inline w-3 h-3 mr-1" />
						{drawing ? 'Dibujando — click para vertices, doble-click para cerrar.' : editingPolygonId ? 'Editando — arrastrá los puntos.' : 'Click en zona para editar.'}
					</p>
					{!drawing && !editingPolygonId && (
						<Button onClick={handleStartDraw} size="sm" className="btn-primary h-7 px-2 text-[10px] font-black uppercase">
							<Plus className="mr-1 h-3 w-3" />Nueva zona
						</Button>
					)}
					{drawing && !newZonePoly && (
						<Button onClick={handleCancelDraw} size="sm" variant="outline" className="h-7 px-2 text-[10px] font-black uppercase border-border">
							<X className="mr-1 h-3 w-3" />Cancelar
						</Button>
					)}
					{drawing && newZonePoly && (
						<div className="flex gap-1.5">
							<Button onClick={handleSaveNewZone} size="sm" className="btn-primary h-7 px-2 text-[10px] font-black uppercase">
								<Check className="mr-1 h-3 w-3" />Guardar zona
							</Button>
							<Button onClick={handleCancelDraw} size="sm" variant="outline" className="h-7 px-2 text-[10px] font-black uppercase border-border">
								<X className="mr-1 h-3 w-3" />
							</Button>
						</div>
					)}
					{editingPolygonId && (
						<div className="flex gap-1.5">
							<Button onClick={handleSavePolygon} size="sm" className="btn-primary h-7 px-2 text-[10px] font-black uppercase">
								<Check className="mr-1 h-3 w-3" />Guardar polígono
							</Button>
							<Button onClick={() => { const layer = layersByIdRef.current.get(editingPolygonId); try { layer?.pm?.disable(); } catch {} setEditingPolygonId(null); }} size="sm" variant="outline" className="h-7 px-2 text-[10px] font-black uppercase border-border">
								<X className="mr-1 h-3 w-3" />
							</Button>
						</div>
					)}
				</div>
				<div ref={containerRef} className="w-full" style={{ height: 480, zIndex: 0 }} />
			</div>

			<div className="space-y-3">
				<div className="bg-card border border-border rounded-xl overflow-hidden">
					<div className="px-3 py-2 bg-muted/20 border-b border-border">
						<p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Polígonos ({poligonos.length})</p>
					</div>
					<div className="divide-y divide-border max-h-64 overflow-y-auto">
						{poligonos.map((z) => (
							<button key={z.id} type="button" onClick={() => setSelectedId(z.id)}
								className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/10 ${z.id === selectedId ? 'bg-primary/10' : ''} ${z.activa === false ? 'opacity-60' : ''}`}>
								<span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
								<span className="flex-1 font-black uppercase tracking-tight truncate">{z.nombre}</span>
								<span className="text-[10px] tabular-nums text-muted-foreground">{z.tarifa === 0 ? 'GRATIS' : `$${Number(z.tarifa).toLocaleString('es-AR')}`}</span>
							</button>
						))}
					</div>
				</div>
				{selectedId ? (
					<div className="bg-card border border-border rounded-xl p-3 space-y-3">
						<p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Editar zona</p>
						<div className="space-y-1">
							<Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Nombre</Label>
							<Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value.slice(0, 60) })} className="bg-background border-border h-9 text-xs font-bold" />
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1">
								<Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Color</Label>
								<div className="flex gap-1.5">
									<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-9 h-9 rounded border border-border bg-background cursor-pointer" />
									<Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1 bg-background border-border h-9 text-xs font-bold tabular-nums" />
								</div>
							</div>
							<div className="space-y-1">
								<Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tarifa</Label>
								<Input type="number" min="0" step="100" value={form.tarifa} onChange={(e) => setForm({ ...form, tarifa: e.target.value })} className="bg-background border-border h-9 text-xs font-black tabular-nums" />
							</div>
						</div>
						<div className="flex items-center justify-between">
							<Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Activa</Label>
							<Switch checked={form.activa} onCheckedChange={(v) => setForm({ ...form, activa: v })} />
						</div>
						<div className="flex gap-2 pt-1">
							<Button onClick={handleSave} disabled={saving || editingPolygonId === selectedId} className="flex-1 btn-primary h-9 text-xs font-black uppercase">
								{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1 h-3 w-3" />Guardar</>}
							</Button>
							<Button onClick={handleDelete} disabled={deleting} variant="outline" className="h-9 px-3 text-xs font-black uppercase border-red-500/40 text-red-400 hover:bg-red-500/10">
								{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3 w-3" />}
							</Button>
						</div>
						<Button onClick={handleEditPolygon} disabled={drawing} variant="outline" className="w-full h-9 text-xs font-black uppercase border-border">
							<Edit3 className="mr-1 h-3 w-3" />
							{editingPolygonId === selectedId ? 'Cancelar edición' : 'Editar polígono (drag)'}
						</Button>
					</div>
				) : (
					<div className="bg-card border border-border border-dashed rounded-xl p-4 text-center">
						<p className="text-xs font-bold text-muted-foreground">Click en una zona del mapa para editarla.</p>
					</div>
				)}
			</div>
		</div>
	);
};

// ═════════════════════════════════════════════════════════════════
// MODO DISTANCIA RECORRIDA — OlaClick "Distancia recorrida"
//   precio_envío = base + km × por_km, cutoff distancia_max.
// ═════════════════════════════════════════════════════════════════
const ModoDistanciaForm = ({ settingsRecord, onSaved }) => {
	const [base, setBase] = useState(() => Number(settingsRecord?.envio_base) || 0);
	const [porKm, setPorKm] = useState(() => Number(settingsRecord?.envio_por_km) || 0);
	const [maxKm, setMaxKm] = useState(() => Number(settingsRecord?.envio_max_km) || 0);
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		if (!settingsRecord?.id) return;
		setSaving(true);
		try {
			await pb.collection('settings').update(settingsRecord.id, {
				envio_base: Math.max(0, Number(base) || 0),
				envio_por_km: Math.max(0, Number(porKm) || 0),
				envio_max_km: Math.max(0, Number(maxKm) || 0),
			}, { requestKey: null });
			await loadLocalCenter();
			toast.success('Configuración de envío guardada');
			onSaved?.();
		} catch (err) {
			toast.error('Error al guardar: ' + (err?.message || ''));
		} finally { setSaving(false); }
	};

	// Preview: tabla de precios para 1/3/5/10 km (los típicos).
	const preview = [1, 3, 5, 10, 20].map((km) => ({
		km,
		precio: Math.round((Number(base) || 0) + km * (Number(porKm) || 0)),
		fueraCobertura: (Number(maxKm) || 0) > 0 && km > Number(maxKm),
	}));

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
			<div className="bg-card border border-border rounded-xl p-4 space-y-3">
				<p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
					<Route className="inline w-3 h-3 mr-1.5" />Distancia recorrida
				</p>
				<p className="text-[10px] text-muted-foreground leading-relaxed">
					El cliente paga según los kilómetros desde el local. Más allá del cutoff queda "fuera de zona".
				</p>
				<div className="grid grid-cols-3 gap-2">
					<div className="space-y-1">
						<Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Precio base ($)</Label>
						<Input type="number" min="0" step="100" value={base}
							onChange={(e) => setBase(e.target.value)}
							className="bg-background border-border h-9 text-xs font-black tabular-nums" />
					</div>
					<div className="space-y-1">
						<Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Precio por km ($)</Label>
						<Input type="number" min="0" step="50" value={porKm}
							onChange={(e) => setPorKm(e.target.value)}
							className="bg-background border-border h-9 text-xs font-black tabular-nums" />
					</div>
					<div className="space-y-1">
						<Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cutoff (km)</Label>
						<Input type="number" min="0" step="1" value={maxKm}
							onChange={(e) => setMaxKm(e.target.value)}
							className="bg-background border-border h-9 text-xs font-black tabular-nums" />
					</div>
				</div>
				<div className="bg-muted/20 border border-border rounded-md p-2 text-[10px] text-muted-foreground">
					<strong className="text-foreground">Fórmula:</strong> precio_envío = ${Number(base) || 0} + km × ${Number(porKm) || 0}
					{Number(maxKm) > 0 && <span> (máx {Number(maxKm)} km)</span>}
				</div>
				<Button onClick={handleSave} disabled={saving}
					className="btn-primary w-full h-9 text-[11px] font-black uppercase tracking-wide">
					{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="mr-1 h-3.5 w-3.5" />Guardar</>}
				</Button>
			</div>
			<div className="bg-card border border-border rounded-xl overflow-hidden">
				<div className="px-3 py-2 bg-muted/20 border-b border-border">
					<p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preview de precios</p>
				</div>
				<div className="divide-y divide-border">
					{preview.map((p) => (
						<div key={p.km} className={`flex items-center justify-between px-3 py-2 text-xs ${p.fueraCobertura ? 'opacity-50' : ''}`}>
							<span className="font-bold tabular-nums">{p.km} km</span>
							<span className="font-black tabular-nums">
								{p.fueraCobertura
									? <span className="text-red-400 text-[10px]">FUERA DE COBERTURA</span>
									: `$${p.precio.toLocaleString('es-AR')}`}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

// ═════════════════════════════════════════════════════════════════
// MODO PRECIO FIJO — mismo precio para todos los pedidos
// ═════════════════════════════════════════════════════════════════
const ModoFijoForm = ({ settingsRecord, onSaved }) => {
	const [base, setBase] = useState(() => Number(settingsRecord?.envio_base) || 0);
	const [saving, setSaving] = useState(false);
	const handleSave = async () => {
		if (!settingsRecord?.id) return;
		setSaving(true);
		try {
			await pb.collection('settings').update(settingsRecord.id, {
				envio_base: Math.max(0, Number(base) || 0),
			}, { requestKey: null });
			await loadLocalCenter();
			toast.success('Precio de envío guardado');
			onSaved?.();
		} catch (err) {
			toast.error('Error al guardar: ' + (err?.message || ''));
		} finally { setSaving(false); }
	};
	return (
		<div className="bg-card border border-border rounded-xl p-4 space-y-3 max-w-md">
			<p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
				<DollarSign className="inline w-3 h-3 mr-1.5" />Precio fijo
			</p>
			<p className="text-[10px] text-muted-foreground leading-relaxed">
				Todos los pedidos pagan el mismo precio de envío, sin importar la distancia.
			</p>
			<div className="space-y-1">
				<Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Precio de envío ($)</Label>
				<Input type="number" min="0" step="100" value={base}
					onChange={(e) => setBase(e.target.value)}
					className="bg-background border-border h-9 text-xs font-black tabular-nums" />
			</div>
			<Button onClick={handleSave} disabled={saving}
				className="btn-primary w-full h-9 text-[11px] font-black uppercase tracking-wide">
				{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="mr-1 h-3.5 w-3.5" />Guardar</>}
			</Button>
		</div>
	);
};

// ═════════════════════════════════════════════════════════════════
// CONTENEDOR — wrapper con selector de modo + secciones específicas
// ═════════════════════════════════════════════════════════════════
const ZonasAdmin = () => {
	const [zonas, setZonas] = useState([]);
	const [loading, setLoading] = useState(true);
	const [settingsRecord, setSettingsRecord] = useState(null);
	const [modo, setModo] = useState('zonas'); // 'zonas' | 'distancia' | 'fijo'
	const [savingModo, setSavingModo] = useState(false);

	const fetchAll = async () => {
		try {
			const [records, settingsList] = await Promise.all([
				pb.collection('zonas_delivery').getFullList({ sort: 'orden,zona_id', requestKey: null }),
				pb.collection('settings').getList(1, 1, { requestKey: null }),
			]);
			setZonas(records);
			const s = settingsList.items[0] || null;
			setSettingsRecord(s);
			const m = String(s?.modo_envio || 'zonas').trim().toLowerCase();
			setModo(['distancia', 'fijo', 'zonas'].includes(m) ? m : 'zonas');
		} catch (err) {
			console.error('[ZonasAdmin] load failed:', err);
			toast.error('No pude cargar las zonas');
		} finally { setLoading(false); }
	};

	useEffect(() => {
		let cancelled = false;
		fetchAll();
		let unsub = null;
		pb.collection('zonas_delivery').subscribe('*', () => { if (!cancelled) fetchAll(); })
			.then((u) => { unsub = u; }).catch(() => {});
		return () => { cancelled = true; if (unsub) try { unsub(); } catch {} };
	}, []);

	const handleChangeModo = async (nuevoModo) => {
		if (nuevoModo === modo || !settingsRecord?.id) {
			setModo(nuevoModo);
			return;
		}
		setSavingModo(true);
		try {
			await pb.collection('settings').update(settingsRecord.id, {
				modo_envio: nuevoModo,
			}, { requestKey: null });
			setModo(nuevoModo);
			await loadLocalCenter();
			toast.success(`Modo de envío: ${nuevoModo === 'distancia' ? 'Distancia recorrida' : nuevoModo === 'fijo' ? 'Precio fijo' : 'Por zonas'}`);
		} catch (err) {
			toast.error('Error al cambiar de modo');
		} finally { setSavingModo(false); }
	};

	if (loading) return <Skeleton className="h-96 w-full rounded-xl" />;

	const modos = [
		{ key: 'distancia', label: 'Distancia recorrida', desc: 'Base + km × tarifa (OlaClick)', icon: Route },
		{ key: 'zonas', label: 'Por zonas', desc: 'Círculos o polígonos', icon: Target },
		{ key: 'fijo', label: 'Precio fijo', desc: 'Mismo precio para todos', icon: DollarSign },
	];

	return (
		<div className="space-y-3">
			{/* Selector de modo (siempre arriba) */}
			<div className="bg-card border border-border rounded-xl p-3">
				<p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
					Modo de cálculo del envío
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
					{modos.map(({ key, label, desc, icon: Icon }) => (
						<button
							key={key}
							type="button"
							disabled={savingModo}
							onClick={() => handleChangeModo(key)}
							className={`text-left rounded-lg border p-2.5 transition-all ${
								modo === key
									? 'border-primary bg-primary/10 ring-1 ring-primary'
									: 'border-border bg-background hover:bg-muted/20'
							} ${savingModo ? 'opacity-60' : ''}`}
						>
							<div className="flex items-center gap-2">
								<Icon className={`w-3.5 h-3.5 ${modo === key ? 'text-primary' : 'text-muted-foreground'}`} />
								<span className={`text-[11px] font-black uppercase tracking-wide ${modo === key ? 'text-primary' : 'text-foreground'}`}>{label}</span>
							</div>
							<p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
						</button>
					))}
				</div>
			</div>

			{/* Sección activa según el modo */}
			{modo === 'distancia' && (
				<ModoDistanciaForm settingsRecord={settingsRecord} onSaved={fetchAll} />
			)}
			{modo === 'fijo' && (
				<ModoFijoForm settingsRecord={settingsRecord} onSaved={fetchAll} />
			)}
			{modo === 'zonas' && (
				<Tabs defaultValue="distancia" className="space-y-3">
					<TabsList className="bg-card border border-border p-0.5 h-auto">
						<TabsTrigger value="distancia" className="font-black uppercase tracking-wide py-1.5 px-3 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-1.5">
							<Target className="w-3 h-3" />Círculos (rangos)
						</TabsTrigger>
						<TabsTrigger value="poligono" className="font-black uppercase tracking-wide py-1.5 px-3 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-1.5">
							<MapPin className="w-3 h-3" />Polígonos (avanzado)
						</TabsTrigger>
					</TabsList>
					<TabsContent value="distancia">
						<ZonasPorDistancia zonas={zonas} onChanged={fetchAll} />
					</TabsContent>
					<TabsContent value="poligono">
						<ZonasPorPoligono zonas={zonas} onChanged={fetchAll} />
					</TabsContent>
				</Tabs>
			)}
		</div>
	);
};

export default ZonasAdmin;
