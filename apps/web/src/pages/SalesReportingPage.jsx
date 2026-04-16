
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, ShoppingBag, Banknote, CreditCard, Truck, Calendar, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const formatPrice = (price) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);

const toISODate = (d) => format(d, 'yyyy-MM-dd');
const todayISO = () => toISODate(new Date());

// Presets de rango de fechas
const PRESETS = [
  {
    key: 'today',
    label: 'Hoy',
    range: () => ({ from: toISODate(new Date()), to: toISODate(new Date()) }),
  },
  {
    key: 'yesterday',
    label: 'Ayer',
    range: () => { const y = subDays(new Date(), 1); return { from: toISODate(y), to: toISODate(y) }; },
  },
  {
    key: 'week',
    label: 'Esta semana',
    range: () => ({
      from: toISODate(startOfWeek(new Date(), { weekStartsOn: 1 })),
      to: toISODate(endOfWeek(new Date(), { weekStartsOn: 1 })),
    }),
  },
  {
    key: 'month',
    label: 'Este mes',
    range: () => ({ from: toISODate(startOfMonth(new Date())), to: toISODate(endOfMonth(new Date())) }),
  },
  {
    key: 'prevMonth',
    label: 'Mes pasado',
    range: () => {
      const prev = subMonths(new Date(), 1);
      return { from: toISODate(startOfMonth(prev)), to: toISODate(endOfMonth(prev)) };
    },
  },
  {
    key: '30d',
    label: 'Últimos 30 días',
    range: () => ({ from: toISODate(subDays(new Date(), 29)), to: toISODate(new Date()) }),
  },
];

// Body de la pantalla de Reportes, sin Header ni container.
// Se usa embebido como tab dentro del AdminDashboard y también por el
// wrapper SalesReportingPage (página standalone para deep-links legacy).
export const ReportsContent = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState('today');
  const [dateRange, setDateRange] = useState(PRESETS[0].range());

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (preset) => {
    setActivePreset(preset.key);
    const r = preset.range();
    setDateRange(r);
    loadOrders(r);
  };

  const loadOrders = async (rangeOverride) => {
    const range = rangeOverride || dateRange;
    setLoading(true);
    try {
      const fromObj = startOfDay(parseISO(range.from));
      const toObj = endOfDay(parseISO(range.to));
      const filterString = `orderStatus='Finalizado' && created >= "${fromObj.toISOString()}" && created <= "${toObj.toISOString()}"`;

      const results = await pb.collection('orders').getFullList({
        filter: filterString,
        sort: '-created',
        requestKey: null,
      });
      setOrders(results);
    } catch (error) {
      console.error('[loadOrders] failed:', error);
      toast.error('Error al cargar los pedidos');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Cómputos agregados ───────────────────────────────────────────
  const stats = (() => {
    let totalOrders = 0;
    let totalSubtotal = 0;
    let totalShipping = 0;
    let grandTotal = 0;
    let efectivoTotal = 0;
    let efectivoCount = 0;
    let transferenciaTotal = 0;
    let transferenciaCount = 0;
    const perTimeSlot = {};
    const productMap = {};
    const perDay = {};
    const perMonth = {};

    orders.forEach((order) => {
      totalOrders += 1;
      const shipping = order.precio_envio_snapshot || 0;
      const total = order.totalAmount || 0;
      const subtotal = total - shipping;
      totalSubtotal += subtotal;
      totalShipping += shipping;
      grandTotal += total;

      const paymentMethod = (order.paymentMethod || '').toLowerCase();
      if (paymentMethod === 'efectivo') {
        efectivoTotal += total;
        efectivoCount += 1;
      } else if (paymentMethod === 'transferencia') {
        transferenciaTotal += total;
        transferenciaCount += 1;
      }

      const slot = order.deliveryTimeSlot || 'sin horario';
      perTimeSlot[slot] = (perTimeSlot[slot] || 0) + total;

      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const name = item.productName || 'Unknown';
          if (!productMap[name]) productMap[name] = { count: 0, revenue: 0 };
          productMap[name].count += item.quantity || 1;
          productMap[name].revenue += (item.price * item.quantity) || 0;
        });
      }

      // Caja diaria
      const dayKey = (order.created || '').slice(0, 10);
      if (dayKey) {
        if (!perDay[dayKey]) {
          perDay[dayKey] = {
            date: dayKey,
            orders: 0,
            subtotal: 0,
            shipping: 0,
            total: 0,
            efectivo: 0,
            efectivoCount: 0,
            transferencia: 0,
            transferenciaCount: 0,
          };
        }
        const d = perDay[dayKey];
        d.orders += 1;
        d.subtotal += subtotal;
        d.shipping += shipping;
        d.total += total;
        if (paymentMethod === 'efectivo') { d.efectivo += total; d.efectivoCount += 1; }
        if (paymentMethod === 'transferencia') { d.transferencia += total; d.transferenciaCount += 1; }
      }

      // Caja mensual
      const monthKey = (order.created || '').slice(0, 7);
      if (monthKey) {
        if (!perMonth[monthKey]) {
          perMonth[monthKey] = {
            month: monthKey,
            orders: 0,
            subtotal: 0,
            shipping: 0,
            total: 0,
            efectivo: 0,
            transferencia: 0,
          };
        }
        const m = perMonth[monthKey];
        m.orders += 1;
        m.subtotal += subtotal;
        m.shipping += shipping;
        m.total += total;
        if (paymentMethod === 'efectivo') m.efectivo += total;
        if (paymentMethod === 'transferencia') m.transferencia += total;
      }
    });

    return {
      totalOrders,
      totalSubtotal,
      totalShipping,
      grandTotal,
      efectivoTotal,
      efectivoCount,
      transferenciaTotal,
      transferenciaCount,
      perTimeSlot,
      mostOrderedProducts: Object.entries(productMap)
        .map(([name, d]) => ({ name, count: d.count, revenue: d.revenue }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      perDay: Object.values(perDay).sort((a, b) => b.date.localeCompare(a.date)),
      perMonth: Object.values(perMonth).sort((a, b) => b.month.localeCompare(a.month)),
    };
  })();

  const avgTicket = stats.totalOrders > 0 ? stats.grandTotal / stats.totalOrders : 0;
  const timeSlotChartData = Object.entries(stats.perTimeSlot).map(([slot, revenue]) => ({ slot, revenue }));

  const handleApplyCustom = (e) => {
    e.preventDefault();
    setActivePreset('custom');
    loadOrders();
  };

  return (
    <div className="space-y-4">
      {/* Presets de rango + custom */}
          <Card className="bg-card border-border shadow-sm mb-4">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-16 shrink-0">Período</span>
                {PRESETS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p)}
                    className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wide border transition-colors ${
                      activePreset === p.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setActivePreset('custom')}
                  className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wide border transition-colors ${
                    activePreset === 'custom'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  Personalizado
                </button>
              </div>

              {activePreset === 'custom' && (
                <form onSubmit={handleApplyCustom} className="flex flex-col sm:flex-row gap-2 items-end pt-1 border-t border-border">
                  <div className="flex-1 w-full">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Desde</Label>
                    <Input
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                      max={todayISO()}
                      className="bg-background border-border text-foreground h-9 text-xs font-bold"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Hasta</Label>
                    <Input
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                      max={todayISO()}
                      className="bg-background border-border text-foreground h-9 text-xs font-bold"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="btn-primary h-9 px-4 text-[11px] font-black uppercase">
                    {loading ? '...' : 'Aplicar'}
                  </Button>
                </form>
              )}

              <p className="text-[10px] text-muted-foreground font-medium">
                <Calendar className="inline w-3 h-3 mr-1" />
                Mostrando del <span className="font-black text-foreground">{dateRange.from}</span> al <span className="font-black text-foreground">{dateRange.to}</span>
                {' · '}
                {stats.totalOrders} {stats.totalOrders === 1 ? 'pedido finalizado' : 'pedidos finalizados'}
              </p>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
          ) : stats.totalOrders === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-16 text-center">
                <p className="text-sm font-bold uppercase text-muted-foreground">No hay pedidos finalizados en este período</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* KPIs principales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card className="bg-primary text-primary-foreground border-primary shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Caja total</p>
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-black tabular-nums">{formatPrice(stats.grandTotal)}</p>
                    <p className="text-[10px] font-bold uppercase opacity-70 mt-1">{stats.totalOrders} pedidos</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Efectivo</p>
                      <Banknote className="h-4 w-4 text-orange-400" />
                    </div>
                    <p className="text-2xl font-black tabular-nums">{formatPrice(stats.efectivoTotal)}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1">{stats.efectivoCount} pedidos</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transferencia</p>
                      <CreditCard className="h-4 w-4 text-green-400" />
                    </div>
                    <p className="text-2xl font-black tabular-nums">{formatPrice(stats.transferenciaTotal)}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1">{stats.transferenciaCount} pedidos</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ticket promedio</p>
                      <ShoppingBag className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-2xl font-black tabular-nums">{formatPrice(avgTicket)}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Subtotal: {formatPrice(stats.totalSubtotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Caja: pestañas diaria / mensual */}
              <Tabs defaultValue="diaria" className="space-y-3 mb-4">
                <TabsList className="bg-card border border-border p-0.5 h-auto">
                  <TabsTrigger value="diaria" className="font-black uppercase tracking-wide py-1.5 px-3 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Caja diaria
                  </TabsTrigger>
                  <TabsTrigger value="mensual" className="font-black uppercase tracking-wide py-1.5 px-3 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Caja mensual
                  </TabsTrigger>
                </TabsList>

                {/* CAJA DIARIA */}
                <TabsContent value="diaria">
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-muted/20 border-b border-border">
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Pedidos</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Subtotal</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Envíos</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Efectivo</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Transfer.</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {stats.perDay.map(d => (
                            <tr key={d.date} className="hover:bg-muted/10 transition-colors">
                              <td className="px-3 py-2 font-black text-xs uppercase">
                                {format(parseISO(d.date), "d MMM yyyy", { locale: es })}
                                <div className="text-[9px] font-bold text-muted-foreground">{format(parseISO(d.date), "EEEE", { locale: es })}</div>
                              </td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right">{d.orders}</td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-muted-foreground">{formatPrice(d.subtotal)}</td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-muted-foreground">{formatPrice(d.shipping)}</td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-orange-400">
                                {formatPrice(d.efectivo)}
                                {d.efectivoCount > 0 && <div className="text-[9px] text-muted-foreground">({d.efectivoCount})</div>}
                              </td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-green-400">
                                {formatPrice(d.transferencia)}
                                {d.transferenciaCount > 0 && <div className="text-[9px] text-muted-foreground">({d.transferenciaCount})</div>}
                              </td>
                              <td className="px-3 py-2 text-sm font-black tabular-nums text-right text-primary">{formatPrice(d.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-primary/10 border-t-2 border-primary/30">
                          <tr>
                            <td className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Total período</td>
                            <td className="px-3 py-2 text-xs font-black tabular-nums text-right">{stats.totalOrders}</td>
                            <td className="px-3 py-2 text-xs font-black tabular-nums text-right">{formatPrice(stats.totalSubtotal)}</td>
                            <td className="px-3 py-2 text-xs font-black tabular-nums text-right">{formatPrice(stats.totalShipping)}</td>
                            <td className="px-3 py-2 text-xs font-black tabular-nums text-right text-orange-400">{formatPrice(stats.efectivoTotal)}</td>
                            <td className="px-3 py-2 text-xs font-black tabular-nums text-right text-green-400">{formatPrice(stats.transferenciaTotal)}</td>
                            <td className="px-3 py-2 text-sm font-black tabular-nums text-right text-primary">{formatPrice(stats.grandTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </TabsContent>

                {/* CAJA MENSUAL */}
                <TabsContent value="mensual">
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-muted/20 border-b border-border">
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mes</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Pedidos</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Subtotal</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Envíos</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Efectivo</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Transfer.</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {stats.perMonth.map(m => (
                            <tr key={m.month} className="hover:bg-muted/10 transition-colors">
                              <td className="px-3 py-2 font-black text-xs uppercase">
                                {format(parseISO(`${m.month}-01`), "MMMM yyyy", { locale: es })}
                              </td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right">{m.orders}</td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-muted-foreground">{formatPrice(m.subtotal)}</td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-muted-foreground">{formatPrice(m.shipping)}</td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-orange-400">{formatPrice(m.efectivo)}</td>
                              <td className="px-3 py-2 text-xs font-bold tabular-nums text-right text-green-400">{formatPrice(m.transferencia)}</td>
                              <td className="px-3 py-2 text-sm font-black tabular-nums text-right text-primary">{formatPrice(m.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="py-3 px-4 border-b border-border bg-muted/5">
                    <CardTitle className="text-sm font-black uppercase tracking-wide">Top productos</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 pb-3">
                    {stats.mostOrderedProducts.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={stats.mostOrderedProducts}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '6px' }}
                            itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', fontSize: '12px' }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center">
                        <p className="text-muted-foreground font-bold uppercase text-xs">Sin datos</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="py-3 px-4 border-b border-border bg-muted/5">
                    <CardTitle className="text-sm font-black uppercase tracking-wide">Ventas por horario</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 pb-3">
                    {timeSlotChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={timeSlotChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="slot" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '6px' }}
                            itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', fontSize: '12px' }}
                            formatter={(value) => formatPrice(value)}
                          />
                          <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center">
                        <p className="text-muted-foreground font-bold uppercase text-xs">Sin datos</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
    </div>
  );
};

// Wrapper standalone para la ruta /gestion/reportes (deep-links viejos).
// Internamente renderiza ReportsContent dentro del layout público con Header.
const SalesReportingPage = () => {
  return (
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
};

export default SalesReportingPage;
