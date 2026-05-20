
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, Calendar, ArrowLeft, ShoppingBag, Wallet, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FORMA_PAGO } from '@/lib/orderConstants';

const formatPrice = (price) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);

const toISODate = (d) => format(d, 'yyyy-MM-dd');
const todayISO = () => toISODate(new Date());

// Presets de rango de fechas — los mismos para ambos tabs.
const PRESETS = [
  { key: 'today', label: 'Hoy',
    range: () => ({ from: toISODate(new Date()), to: toISODate(new Date()) }) },
  { key: 'yesterday', label: 'Ayer',
    range: () => { const y = subDays(new Date(), 1); return { from: toISODate(y), to: toISODate(y) }; } },
  { key: 'week', label: 'Esta semana',
    range: () => ({
      from: toISODate(startOfWeek(new Date(), { weekStartsOn: 1 })),
      to: toISODate(endOfWeek(new Date(), { weekStartsOn: 1 })),
    }) },
  { key: 'month', label: 'Este mes',
    range: () => ({ from: toISODate(startOfMonth(new Date())), to: toISODate(endOfMonth(new Date())) }) },
  { key: 'prevMonth', label: 'Mes pasado',
    range: () => {
      const prev = subMonths(new Date(), 1);
      return { from: toISODate(startOfMonth(prev)), to: toISODate(endOfMonth(prev)) };
    } },
  { key: '30d', label: 'Últimos 30 días',
    range: () => ({ from: toISODate(subDays(new Date(), 29)), to: toISODate(new Date()) }) },
];

const normalizeMethod = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (s === FORMA_PAGO.EFECTIVO.toLowerCase()) return FORMA_PAGO.EFECTIVO;
  if (s === FORMA_PAGO.TRANSFERENCIA.toLowerCase()) return FORMA_PAGO.TRANSFERENCIA;
  if (s === FORMA_PAGO.MERCADOPAGO.toLowerCase()) return FORMA_PAGO.MERCADOPAGO;
  return '';
};

// Compat retro: orders viejos no traen incluyeFritas booleano. Asumimos:
// hamburguesa (hasMedallions != false) → lleva fritas; nuggets → no.
// Mismo helper que usan los tickets de impresión (PrintTicketDelivery,
// PrintKitchenOrder) para mantener consistencia.
const itemIncluyeFritas = (item) =>
  typeof item?.incluyeFritas === 'boolean'
    ? item.incluyeFritas
    : item?.hasMedallions !== false;

// Etiqueta única para la fila virtual de papas fritas en los rankings.
const PAPAS_LABEL = 'PAPAS FRITAS (INCLUIDAS)';

// Medallones de un pedido = suma de pattyCount * quantity por cada item
// que es hamburguesa (hasMedallions != false). Nuggets y similares no
// cuentan. Sirve para que el local proyecte compra de carne.
const orderMedallones = (order) => {
  if (!Array.isArray(order?.items)) return 0;
  return order.items.reduce((sum, item) => {
    if (item?.hasMedallions === false) return sum;
    const patty = Number(item?.pattyCount) || 0;
    const qty = Number(item?.quantity) || 0;
    return sum + patty * qty;
  }, 0);
};

// Un pedido está "registrado" si tiene clienteId (collection clientes) o
// user_id (collection users legacy). Si no tiene ninguno → invitado
// (checkout sin cuenta).
const isRegisteredOrder = (o) => Boolean(o?.clienteId || o?.user_id);

// ══════════════════════════════════════════════════════════════════
// Selector de período (presets + custom)
// ══════════════════════════════════════════════════════════════════
const PeriodSelector = ({ dateRange, setDateRange, activePreset, setActivePreset, onApply, loading }) => {
  const [customOpen, setCustomOpen] = useState(false);
  return (
    <Card className="bg-card border-border shadow-sm mb-4">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-16 shrink-0">Período</span>
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => { setActivePreset(p.key); const r = p.range(); setDateRange(r); onApply(r); setCustomOpen(false); }}
              className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wide border transition-colors ${
                activePreset === p.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
              }`}
            >{p.label}</button>
          ))}
          <button
            onClick={() => { setActivePreset('custom'); setCustomOpen(true); }}
            className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wide border transition-colors ${
              activePreset === 'custom'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
          >Personalizado</button>
        </div>

        {customOpen && (
          <form onSubmit={(e) => { e.preventDefault(); onApply(); }} className="flex flex-col sm:flex-row gap-2 items-end pt-1 border-t border-border">
            <div className="flex-1 w-full">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Desde</Label>
              <Input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} max={todayISO()}
                className="bg-background border-border text-foreground h-9 text-xs font-bold" />
            </div>
            <div className="flex-1 w-full">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Hasta</Label>
              <Input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} max={todayISO()}
                className="bg-background border-border text-foreground h-9 text-xs font-bold" />
            </div>
            <Button type="submit" disabled={loading} className="btn-primary h-9 px-4 text-[11px] font-black uppercase">
              {loading ? '...' : 'Aplicar'}
            </Button>
          </form>
        )}

        <p className="text-[10px] text-muted-foreground font-medium">
          <Calendar className="inline w-3 h-3 mr-1" />
          Del <span className="font-black text-foreground">{dateRange.from}</span> al <span className="font-black text-foreground">{dateRange.to}</span>
        </p>
      </CardContent>
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════
// TAB 1 — Productos más vendidos
// ══════════════════════════════════════════════════════════════════
const ProductosTab = ({ dateRange }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fromObj = startOfDay(parseISO(dateRange.from));
        const toObj = endOfDay(parseISO(dateRange.to));
        // Paso 1: detectar jornadas con actividad en el rango via pedidos
        // pagados creados dentro de él. Mismo approach que CierresTab.
        const seedFilter = `paymentStatus='Pagado' && orderStatus != 'Cancelado' && created >= "${fromObj.toISOString()}" && created <= "${toObj.toISOString()}"`;
        const seedOrders = await pb.collection('orders').getFullList({
          filter: seedFilter, requestKey: null, fields: 'jornadaId',
        });
        const jornadaIds = [...new Set(seedOrders.map((o) => o.jornadaId).filter(Boolean))];

        // Paso 2: cargar TODOS los pedidos cobrados de esas jornadas
        // (ignorando `created` — el criterio es pertenencia a la jornada,
        // igual que el detalle del cierre). Esto unifica las cifras de
        // este tab con las del tab Cierres: ambos leen exactamente los
        // mismos pedidos. Antes el filtro por `created` dejaba afuera
        // pedidos hechos antes de medianoche pero cobrados durante una
        // jornada que arrancó después — ese era el bug de "productos
        // vendidos no coincide con cierre".
        let results;
        if (jornadaIds.length === 0) {
          // No hay jornadas en el rango → caen solo los pedidos
          // huérfanos sin jornadaId (cobros sin caja abierta).
          results = await pb.collection('orders').getFullList({
            filter: seedFilter, sort: '-created', requestKey: null,
          });
        } else {
          const idFilter = jornadaIds.map((id) => `jornadaId="${id}"`).join(' || ');
          const fullFilter = `(${idFilter}) && paymentStatus='Pagado' && orderStatus != 'Cancelado'`;
          results = await pb.collection('orders').getFullList({
            filter: fullFilter, sort: '-created', requestKey: null,
          });
        }
        if (!cancelled) setOrders(results);
      } catch (err) {
        console.error('[ProductosTab] loadOrders failed:', err);
        if (!cancelled) {
          toast.error('Error al cargar productos');
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dateRange.from, dateRange.to]);

  const productMap = useMemo(() => {
    const map = {};
    let papasCount = 0;
    orders.forEach((order) => {
      if (!Array.isArray(order.items)) return;
      order.items.forEach((item) => {
        const name = (item.productName || 'Sin nombre').toUpperCase();
        if (!map[name]) map[name] = { count: 0, revenue: 0 };
        const qty = Number(item.quantity) || 1;
        map[name].count += qty;
        map[name].revenue += (Number(item.price) || 0) * qty;
        // Sumamos las porciones de papas en una fila virtual aparte.
        // Las papas vienen INCLUIDAS con la hamburguesa (no se cobran),
        // pero el admin quiere ver cuántas se sirven para stock/control.
        if (itemIncluyeFritas(item)) papasCount += qty;
      });
    });
    if (papasCount > 0) {
      map[PAPAS_LABEL] = { count: papasCount, revenue: 0 };
    }
    return map;
  }, [orders]);

  const ranked = useMemo(() => Object.entries(productMap)
    .map(([name, d]) => ({ name, count: d.count, revenue: d.revenue }))
    .sort((a, b) => b.count - a.count), [productMap]);

  const totalUnits = ranked.reduce((s, p) => s + p.count, 0);
  // Recaudación de items (sin envío) — lo que cobra el producto en sí.
  const totalRevenue = ranked.reduce((s, p) => s + p.revenue, 0);
  // Total cobrado (CON envío) — debe coincidir con la suma del cierre de
  // caja y con totalAmount de las cards de cada pedido. Es lo que entró
  // realmente al negocio.
  const totalCobrado = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const totalEnvios = totalCobrado - totalRevenue;
  // Breakdown registrados vs invitados — para que el admin vea cuántos
  // pedidos del período vinieron de clientes con cuenta vs guest checkout.
  const registeredCount = orders.filter(isRegisteredOrder).length;
  const guestCount = orders.length - registeredCount;

  // Medallones — total del período + desglose por día (para proyectar
  // compra de carne). El día se toma de `created` (slice YYYY-MM-DD).
  const totalMedallones = orders.reduce((s, o) => s + orderMedallones(o), 0);
  const medallonesPorDia = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const dia = (o.created || '').slice(0, 10);
      if (!dia) return;
      if (!map[dia]) map[dia] = { dia, medallones: 0, pedidos: 0 };
      map[dia].medallones += orderMedallones(o);
      map[dia].pedidos += 1;
    });
    return Object.values(map).sort((a, b) => b.dia.localeCompare(a.dia));
  }, [orders]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (ranked.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-16 text-center">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-bold uppercase text-muted-foreground">No hay productos vendidos en este período</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Resumen explícito — 4 números. La "recaudación" del ranking de
          productos no incluye envío; el cierre de caja sí. Mostramos ambos
          + medallones (para proyección de compra de carne). */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Productos vendidos</p>
          <p className="text-base font-black tabular-nums">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Envíos</p>
          <p className="text-base font-black tabular-nums">{formatPrice(totalEnvios)}</p>
        </div>
        <div className="bg-card border border-border border-l-[4px] border-l-amber-500 rounded-lg p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Medallones</p>
          <p className="text-base font-black tabular-nums text-amber-400">{totalMedallones}</p>
        </div>
        <div className="bg-primary text-primary-foreground border border-primary rounded-lg p-3">
          <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-0.5">Total cobrado</p>
          <p className="text-base font-black tabular-nums">{formatPrice(totalCobrado)}</p>
        </div>
      </div>

      {/* Breakdown registrados vs invitados — mide qué tanto del volumen
          viene de clientes con cuenta (recurrencia) vs guests one-off. */}
      <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider">
        <span className="text-muted-foreground">{orders.length} pedidos:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-400">
          ✓ {registeredCount} registrados
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground">
          {guestCount} invitados
        </span>
      </div>

    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="bg-muted/20 border-b border-border">
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-10">#</th>
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Producto</th>
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Unidades</th>
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary text-right">Recaudación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranked.map((p, i) => (
              <tr key={p.name} className="hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 text-xs font-black tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-black text-xs uppercase">{p.name}</td>
                <td className="px-3 py-2 text-sm font-black tabular-nums text-right">{p.count}</td>
                <td className="px-3 py-2 text-sm font-black tabular-nums text-right text-primary">{formatPrice(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-primary/10 border-t-2 border-primary/30">
            <tr>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Total</td>
              <td className="px-3 py-2 text-sm font-black tabular-nums text-right">{totalUnits}</td>
              <td className="px-3 py-2 text-sm font-black tabular-nums text-right text-primary">{formatPrice(totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

      {/* Medallones por día — desglose para proyectar compra de carne.
          Cada hamburguesa suma pattyCount × quantity; nuggets no cuentan. */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-3 py-2 border-b border-border bg-amber-500/5 flex items-center gap-2">
          <span className="text-amber-400 text-xs">●</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Medallones por día</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[420px]">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Día</th>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Pedidos</th>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-400 text-right">Medallones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {medallonesPorDia.map((d) => {
                const fechaTxt = (() => {
                  try { return format(parseISO(d.dia), "d MMM yyyy", { locale: es }); }
                  catch { return d.dia; }
                })();
                return (
                  <tr key={d.dia} className="hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-2 font-black text-xs uppercase">{fechaTxt}</td>
                    <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-muted-foreground">{d.pedidos}</td>
                    <td className="px-3 py-2 text-sm font-black tabular-nums text-right text-amber-400">{d.medallones}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-amber-500/10 border-t-2 border-amber-500/30">
              <tr>
                <td className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Total</td>
                <td className="px-3 py-2 text-xs font-black tabular-nums text-right">{orders.length}</td>
                <td className="px-3 py-2 text-sm font-black tabular-nums text-right text-amber-400">{totalMedallones}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// TAB 2 — Cierres de caja (lista + detalle expandible)
// ══════════════════════════════════════════════════════════════════
const CierreDetalle = ({ jornada }) => {
  const [movimientos, setMovimientos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [movs, pds] = await Promise.all([
          pb.collection('movimientos_caja').getFullList({
            filter: `jornadaId = "${jornada.id}"`, sort: 'created', requestKey: null,
          }).catch(() => []),
          pb.collection('orders').getFullList({
            filter: `jornadaId = "${jornada.id}"`, sort: '-created', requestKey: null,
          }).catch(() => []),
        ]);
        if (!cancelled) {
          setMovimientos(movs);
          setPedidos(pds);
        }
      } catch (err) {
        console.error('[CierreDetalle] failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jornada.id]);

  const productos = useMemo(() => {
    const map = {};
    let papasCount = 0;
    pedidos.forEach((o) => {
      if (o.orderStatus === 'Cancelado') return;
      if (o.paymentStatus !== 'Pagado') return;
      (o.items || []).forEach((item) => {
        const name = (item.productName || 'Sin nombre').toUpperCase();
        if (!map[name]) map[name] = { count: 0, revenue: 0 };
        const qty = Number(item.quantity) || 1;
        map[name].count += qty;
        map[name].revenue += (Number(item.price) || 0) * qty;
        // Fila virtual de papas fritas (incluidas, $0) — para que el admin
        // vea cuántas porciones se sirven aunque no facturen.
        if (itemIncluyeFritas(item)) papasCount += qty;
      });
    });
    if (papasCount > 0) {
      map[PAPAS_LABEL] = { count: papasCount, revenue: 0 };
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [pedidos]);

  const pedidosCobrados = pedidos.filter((p) => p.paymentStatus === 'Pagado' && p.orderStatus !== 'Cancelado');
  const ingresos = movimientos.filter((m) => m.tipo === 'ingreso');
  const egresos = movimientos.filter((m) => m.tipo === 'egreso');
  // Medallones de la jornada — solo pedidos cobrados, no cancelados.
  const medallonesJornada = pedidosCobrados.reduce((s, o) => s + orderMedallones(o), 0);

  // Cálculos en VIVO desde los pedidos (no de los campos congelados de
  // jornada). Cubre el caso "jornada abierta" donde totalEfectivo/cuadre/etc
  // están vacíos hasta el cierre. Y si está cerrada, debe coincidir con
  // jornada.totalEfectivo — si no coincide es porque hubo movimientos
  // post-cierre o porque el cierre se calculó mal.
  const liveCobrosEfectivo = pedidosCobrados
    .filter((o) => normalizeMethod(o.paymentMethod) === FORMA_PAGO.EFECTIVO)
    .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const liveCobrosTransferencia = pedidosCobrados
    .filter((o) => normalizeMethod(o.paymentMethod) === FORMA_PAGO.TRANSFERENCIA)
    .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const liveCobrosMP = pedidosCobrados
    .filter((o) => normalizeMethod(o.paymentMethod) === FORMA_PAGO.MERCADOPAGO)
    .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const liveTotalCobrado = liveCobrosEfectivo + liveCobrosTransferencia + liveCobrosMP;

  const isAbiertaActiva = jornada.estado === 'abierta';

  if (loading) return <div className="p-4"><Skeleton className="h-32 w-full rounded-md" /></div>;

  return (
    <div className="border-t border-border bg-background/40 p-4 space-y-4">
      {/* Resumen rápido — usa cifras EN VIVO desde los pedidos cargados.
          Si la jornada está abierta, los campos congelados (jornada.cuadre,
          jornada.totalEfectivo, etc.) están vacíos; los reemplazamos con
          cálculos en vivo desde paymentMethod + totalAmount de cada pedido
          cobrado. Si está cerrada, debería coincidir con los campos
          congelados (sino el cierre se calculó mal en su momento). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <SummaryBox label="Pedidos cobrados" value={pedidosCobrados.length} />
        <SummaryBox label="Medallones" value={medallonesJornada} colorCls="text-amber-400" />
        <SummaryBox label="Efectivo" value={formatPrice(liveCobrosEfectivo)} colorCls="text-orange-400" />
        <SummaryBox
          label={liveCobrosMP > 0 ? 'Transf. + MP' : 'Transferencias'}
          value={formatPrice(liveCobrosTransferencia + liveCobrosMP)}
          colorCls="text-green-400"
        />
        {isAbiertaActiva ? (
          <SummaryBox label="Total cobrado" value={formatPrice(liveTotalCobrado)} colorCls="text-primary" />
        ) : (
          <SummaryBox
            label="Cuadre"
            value={formatPrice(jornada.cuadre)}
            colorCls={Math.abs(Number(jornada.cuadre) || 0) < 1 ? 'text-green-400' : 'text-red-400'}
          />
        )}
      </div>

      {/* Productos vendidos en esta jornada */}
      <DetailSection
        title="Productos vendidos"
        icon={<ShoppingBag className="w-3.5 h-3.5" />}
        emptyMsg="Sin productos vendidos"
        empty={productos.length === 0}
      >
        <table className="w-full text-left border-collapse min-w-[420px]">
          <thead>
            <tr className="bg-muted/10 border-b border-border">
              <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Producto</th>
              <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">Cant.</th>
              <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">Recaudación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {productos.map((p) => (
              <tr key={p.name}>
                <td className="px-2 py-1 text-xs font-bold uppercase">{p.name}</td>
                <td className="px-2 py-1 text-xs font-black tabular-nums text-right">{p.count}</td>
                <td className="px-2 py-1 text-xs font-black tabular-nums text-right text-primary">{formatPrice(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetailSection>

      {/* Movimientos de dinero (ingresos/egresos manuales) */}
      <DetailSection
        title={`Movimientos de caja (${movimientos.length})`}
        icon={<Wallet className="w-3.5 h-3.5" />}
        emptyMsg="Sin movimientos manuales en esta jornada"
        empty={movimientos.length === 0}
      >
        <table className="w-full text-left border-collapse min-w-[420px]">
          <thead>
            <tr className="bg-muted/10 border-b border-border">
              <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground w-16">Tipo</th>
              <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Motivo</th>
              <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ingresos.map((m) => (
              <tr key={m.id}>
                <td className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />Ingreso
                </td>
                <td className="px-2 py-1 text-xs font-medium">{m.motivo}</td>
                <td className="px-2 py-1 text-xs font-black tabular-nums text-right text-green-400">+{formatPrice(m.monto)}</td>
              </tr>
            ))}
            {egresos.map((m) => (
              <tr key={m.id}>
                <td className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />Egreso
                </td>
                <td className="px-2 py-1 text-xs font-medium">{m.motivo}</td>
                <td className="px-2 py-1 text-xs font-black tabular-nums text-right text-red-400">-{formatPrice(m.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetailSection>

      {/* Pedidos asociados (todos los de la jornada, no solo cobrados).
          Mostramos breakdown registrados vs invitados en el título y un
          chip verde/gris por fila para que el admin vea de un vistazo
          cuántos clientes nuevos pasaron por la app. */}
      {(() => {
        const regsCount = pedidos.filter(isRegisteredOrder).length;
        const guestCount = pedidos.length - regsCount;
        return (
          <DetailSection
            title={`Pedidos (${pedidos.length} · ${regsCount} registrados · ${guestCount} invitados)`}
            icon={<ShoppingBag className="w-3.5 h-3.5" />}
            emptyMsg="Sin pedidos asociados"
            empty={pedidos.length === 0}
          >
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-muted/10 border-b border-border">
                  <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">#</th>
                  <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cliente</th>
                  <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Hora</th>
                  <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                  <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pago</th>
                  <th className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pedidos.map((o) => {
                  const cancelled = o.orderStatus === 'Cancelado';
                  const paid = o.paymentStatus === 'Pagado';
                  const registered = isRegisteredOrder(o);
                  return (
                    <tr key={o.id} className={cancelled ? 'opacity-50' : ''}>
                      <td className="px-2 py-1 text-xs font-black tabular-nums">#{o.orderNumber || o.id.slice(0, 6)}</td>
                      <td className="px-2 py-1 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold uppercase truncate max-w-[120px]">{o.customerName || '-'}</span>
                          <span
                            title={registered ? 'Cliente registrado' : 'Pedido de invitado (sin cuenta)'}
                            className={`shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                              registered
                                ? 'bg-green-500/10 border-green-500/40 text-green-400'
                                : 'bg-muted/30 border-border text-muted-foreground'
                            }`}
                          >
                            {registered ? '✓ REG' : 'INV'}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1 text-xs font-bold tabular-nums text-muted-foreground">{o.deliveryTimeSlot || '-'}</td>
                      <td className="px-2 py-1 text-[10px] font-black uppercase">{o.orderStatus || '-'}</td>
                      <td className="px-2 py-1 text-[10px] font-black uppercase">
                        <span className={paid ? 'text-green-400' : 'text-amber-400'}>{paid ? '✓' : '⏳'} {normalizeMethod(o.paymentMethod) || o.paymentMethod}</span>
                      </td>
                      <td className="px-2 py-1 text-xs font-black tabular-nums text-right text-primary">{formatPrice(o.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DetailSection>
        );
      })()}
    </div>
  );
};

const SummaryBox = ({ label, value, colorCls = 'text-foreground' }) => (
  <div className="bg-card border border-border rounded p-2">
    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
    <p className={`text-sm font-black tabular-nums ${colorCls}`}>{value}</p>
  </div>
);

const DetailSection = ({ title, icon, children, empty, emptyMsg }) => (
  <div className="bg-card border border-border rounded-md overflow-hidden">
    <div className="px-3 py-2 border-b border-border bg-muted/5 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
    </div>
    <div className="overflow-x-auto">
      {empty ? (
        <p className="px-3 py-4 text-[10px] font-bold uppercase text-muted-foreground text-center">{emptyMsg}</p>
      ) : children}
    </div>
  </div>
);

const CierresTab = ({ dateRange }) => {
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fromObj = startOfDay(parseISO(dateRange.from));
        const toObj = endOfDay(parseISO(dateRange.to));
        // Filtramos jornadas a través de los pedidos pagados del rango, no
        // por jornadas.fecha. Motivos:
        //  1) jornadas.fecha tiene timezone — una caja abierta a las 22 del
        //     16 y cerrada 00:30 del 17 puede quedar con fecha=17 según
        //     cómo se setea — eso rompe el filtro "Ayer = 16".
        //  2) Si el admin se olvidó de cerrar la caja, queremos mostrarla
        //     igual (con badge "Abierta") para que vea sus ventas.
        // Approach: agarrar pedidos pagados en el rango → extraer jornadaId
        // únicos → buscar esas jornadas sin importar fecha ni estado.
        const orderFilter = `paymentStatus='Pagado' && orderStatus != 'Cancelado' && created >= "${fromObj.toISOString()}" && created <= "${toObj.toISOString()}"`;
        const paidOrders = await pb.collection('orders').getFullList({
          filter: orderFilter, requestKey: null, fields: 'jornadaId',
        });
        const jornadaIds = [...new Set(paidOrders.map((o) => o.jornadaId).filter(Boolean))];
        if (jornadaIds.length === 0) {
          if (!cancelled) setJornadas([]);
          return;
        }
        const idFilter = jornadaIds.map((id) => `id="${id}"`).join(' || ');
        const results = await pb.collection('jornadas').getFullList({
          filter: idFilter, sort: '-fecha,-horaCierre', requestKey: null,
        });
        if (!cancelled) setJornadas(results);
      } catch (err) {
        console.error('[CierresTab] failed:', err);
        if (!cancelled) {
          toast.error('Error al cargar cierres de caja');
          setJornadas([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dateRange.from, dateRange.to]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (jornadas.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-16 text-center">
          <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-bold uppercase text-muted-foreground">No hay cierres de caja en este período</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {jornadas.map((j) => {
        const isOpen = expandedId === j.id;
        // Jornada todavía abierta: los campos de cierre (totalEfectivo,
        // cuadre, etc.) están vacíos hasta que el admin la cierre. La
        // mostramos igual con badge para que vea que hay actividad.
        const isAbierta = j.estado === 'abierta';
        const fechaTxt = (() => {
          try { return format(parseISO(j.fecha), "d MMM yyyy", { locale: es }); }
          catch { return j.fecha; }
        })();
        const cuadreOk = Math.abs(Number(j.cuadre) || 0) < 1;
        const cuadreCls = cuadreOk ? 'text-green-400' : 'text-red-400';
        const totalFacturado = (Number(j.totalEfectivo) || 0) + (Number(j.totalTransferencias) || 0);
        const borderL = isAbierta ? 'border-l-[4px] border-l-amber-500' : 'border-l-[4px] border-l-primary/30';
        return (
          <div key={j.id} className={`bg-card border border-border ${borderL} rounded-lg overflow-hidden shadow-sm`}>
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : j.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors text-left"
            >
              <div className="shrink-0 w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                {isOpen ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black uppercase tracking-wide truncate">{fechaTxt}</p>
                  {isAbierta && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider shrink-0">
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      Abierta
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tabular-nums">
                  Apertura {j.horaApertura || '—'} · Cierre {isAbierta ? 'sin cerrar' : (j.horaCierre || '—')}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-right">
                {isAbierta ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Expandí para ver detalle en vivo
                  </p>
                ) : (
                  <>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pedidos</p>
                      <p className="text-sm font-black tabular-nums">{j.totalPedidos || 0}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Facturado</p>
                      <p className="text-sm font-black tabular-nums text-primary">{formatPrice(totalFacturado)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cuadre</p>
                      <p className={`text-sm font-black tabular-nums ${cuadreCls}`}>{formatPrice(j.cuadre)}</p>
                    </div>
                  </>
                )}
              </div>
            </button>
            {/* En mobile: chips abajo del header */}
            {!isAbierta && (
              <div className="sm:hidden px-4 pb-3 flex gap-2 flex-wrap text-[10px] font-bold tabular-nums">
                <span className="px-2 py-0.5 rounded bg-background border border-border">{j.totalPedidos || 0} pedidos</span>
                <span className="px-2 py-0.5 rounded bg-background border border-border text-primary">{formatPrice(totalFacturado)}</span>
                <span className={`px-2 py-0.5 rounded bg-background border border-border ${cuadreCls}`}>Cuadre {formatPrice(j.cuadre)}</span>
              </div>
            )}
            {isOpen && <CierreDetalle jornada={j} />}
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// Page wrapper
// ══════════════════════════════════════════════════════════════════
// Body de la pantalla de Reportes, sin Header ni container.
// Se usa embebido como tab dentro del AdminDashboard y también por el
// wrapper SalesReportingPage (página standalone para deep-links legacy).
//
// Estructura: 2 tabs principales con un único selector de período arriba:
//   - Productos: ranking de productos vendidos en el rango.
//   - Cierres de caja: lista de jornadas cerradas; cada fila se expande
//     y muestra detalle (movimientos, pedidos, productos de esa jornada).
//
// NOTA: la "caja general" agregada (KPIs totales del período) NO está acá
// — es feature de la licencia pro. Cada caja se mira individualmente.
export const ReportsContent = () => {
  const [activePreset, setActivePreset] = useState('today');
  const [dateRange, setDateRange] = useState(PRESETS[0].range());
  // Bump del rango aplicado — cambia el key de los tabs para forzar refetch
  // cuando el usuario aplica un custom range con las mismas fechas.
  const [appliedKey, setAppliedKey] = useState(0);
  const onApply = (rangeOverride) => {
    if (rangeOverride) setDateRange(rangeOverride);
    setAppliedKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <PeriodSelector
        dateRange={dateRange}
        setDateRange={setDateRange}
        activePreset={activePreset}
        setActivePreset={setActivePreset}
        onApply={onApply}
        loading={false}
      />

      <Tabs defaultValue="productos" className="space-y-3">
        <TabsList className="bg-card border border-border p-0.5 h-auto">
          <TabsTrigger value="productos" className="font-black uppercase tracking-wide py-1.5 px-3 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-1.5">
            <ShoppingBag className="w-3 h-3" />Productos vendidos
          </TabsTrigger>
          <TabsTrigger value="cierres" className="font-black uppercase tracking-wide py-1.5 px-3 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-1.5">
            <Wallet className="w-3 h-3" />Cierres de caja
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productos">
          <ProductosTab key={`p-${appliedKey}`} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="cierres">
          <CierresTab key={`c-${appliedKey}`} dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Wrapper standalone para la ruta /gestion/reportes (deep-links viejos).
const SalesReportingPage = () => (
  <>
    <Helmet><title>Reportes - DRIP BURGER</title></Helmet>
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <Button asChild variant="outline" size="sm" className="border-border h-8 px-2 text-[11px]">
            <Link to="/gestion"><ArrowLeft className="mr-1 h-3 w-3" />Volver</Link>
          </Button>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">
            Reportes <span className="text-primary">DRIP</span>
          </h1>
          <div className="w-16" />
        </div>
        <ReportsContent />
      </div>
    </div>
  </>
);

export default SalesReportingPage;

