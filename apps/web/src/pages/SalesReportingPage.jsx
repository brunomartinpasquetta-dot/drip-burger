
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, ShoppingBag, CreditCard, Truck } from 'lucide-react';
import { toast } from 'sonner';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const SalesReportingPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Calculate date ranges matching ISO 8601 for PB filters
      const fromDateObj = new Date(dateRange.fromDate);
      fromDateObj.setHours(0, 0, 0, 0);
      
      const toDateObj = new Date(dateRange.toDate);
      toDateObj.setHours(23, 59, 59, 999);
      
      const filterString = `orderStatus='Finalizado' && created >= "${fromDateObj.toISOString()}" && created <= "${toDateObj.toISOString()}"`;

      const orders = await pb.collection('orders').getFullList({
        filter: filterString,
        $autoCancel: false
      });

      let totalOrders = 0;
      let totalSalesSubtotal = 0;
      let totalShipping = 0;
      let grandTotal = 0;
      let efectivoTotal = 0;
      let transferenciaTotal = 0;
      const perTimeSlot = {};
      const productMap = {};

      orders.forEach((order) => {
        totalOrders += 1;
        const shipping = order.precio_envio_snapshot || 0;
        const total = order.totalAmount || 0;
        
        // Correctly split subtotal vs shipping based on recorded snapshot
        // If snapshot is missing but total exists, subtotal = total
        const subtotal = total - shipping;

        totalSalesSubtotal += subtotal;
        totalShipping += shipping;
        grandTotal += total;

        const paymentMethod = (order.paymentMethod || '').toLowerCase();
        if (paymentMethod === 'efectivo') {
          efectivoTotal += total;
        } else if (paymentMethod === 'transferencia') {
          transferenciaTotal += total;
        }

        const timeSlot = order.deliveryTimeSlot || 'unknown';
        if (!perTimeSlot[timeSlot]) perTimeSlot[timeSlot] = 0;
        perTimeSlot[timeSlot] += total;

        if (Array.isArray(order.items)) {
          order.items.forEach((item) => {
            const productName = item.productName || 'Unknown';
            if (!productMap[productName]) {
              productMap[productName] = { count: 0, revenue: 0 };
            }
            productMap[productName].count += item.quantity || 1;
            productMap[productName].revenue += (item.price * item.quantity) || 0;
          });
        }
      });

      const mostOrderedProducts = Object.entries(productMap)
        .map(([productName, data]) => ({
          productName,
          count: data.count,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.count - a.count);

      setStats({
        totalOrders,
        totalSalesSubtotal,
        totalShipping,
        grandTotal,
        efectivoTotal,
        transferenciaTotal,
        perTimeSlot,
        mostOrderedProducts
      });

    } catch (error) {
      toast.error('Error al cargar estadísticas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    loadStats();
  };

  const productChartData = stats?.mostOrderedProducts?.map(p => ({
    name: p.productName,
    count: p.count,
    revenue: p.revenue
  })) || [];

  const timeSlotChartData = stats?.perTimeSlot
    ? Object.entries(stats.perTimeSlot).map(([slot, revenue]) => ({
        slot,
        revenue
      }))
    : [];

  return (
    <>
      <Helmet>
        <title>Reportes - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-10">
            Data <span className="text-primary">DRIP BURGER</span>
          </h1>

          <Card className="mb-10 bg-card border-border shadow-sm">
            <CardHeader className="pb-4 border-b border-border bg-muted/5">
              <CardTitle className="text-xl font-black uppercase tracking-wide">Filtro de Fechas</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleApplyFilter} className="flex flex-col md:flex-row gap-6 items-end">
                <div className="flex-1 w-full">
                  <Label htmlFor="fromDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Desde</Label>
                  <Input
                    id="fromDate"
                    type="date"
                    value={dateRange.fromDate}
                    onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
                    className="bg-background border-border text-foreground h-12 font-bold"
                  />
                </div>
                <div className="flex-1 w-full">
                  <Label htmlFor="toDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Hasta</Label>
                  <Input
                    id="toDate"
                    type="date"
                    value={dateRange.toDate}
                    onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
                    className="bg-background border-border text-foreground h-12 font-bold"
                  />
                </div>
                <Button type="submit" disabled={loading} className="btn-primary h-12 px-8 w-full md:w-auto shadow-sm">
                  {loading ? 'Procesando...' : 'Actualizar Datos'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
            </div>
          ) : stats ? (
            <>
              {/* Main Totals */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recaudación (Subtotal)</p>
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <p className="text-3xl font-black">{formatPrice(stats.totalSalesSubtotal)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Envíos</p>
                      <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                        <Truck className="h-5 w-5 text-secondary-foreground" />
                      </div>
                    </div>
                    <p className="text-3xl font-black">{formatPrice(stats.totalShipping)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-primary text-primary-foreground border-primary shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary-foreground/80">Caja Total</p>
                      <div className="w-10 h-10 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary-foreground" />
                      </div>
                    </div>
                    <p className="text-4xl font-black">{formatPrice(stats.grandTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pedidos Completados</p>
                      <div className="w-10 h-10 bg-muted/20 rounded-lg flex items-center justify-center">
                        <ShoppingBag className="h-5 w-5 text-foreground" />
                      </div>
                    </div>
                    <p className="text-3xl font-black">{stats.totalOrders}</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cobro Efectivo</p>
                      <div className="w-10 h-10 bg-muted/20 rounded-lg flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-foreground" />
                      </div>
                    </div>
                    <p className="text-3xl font-black">{formatPrice(stats.efectivoTotal)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cobro Transferencia</p>
                      <div className="w-10 h-10 bg-muted/20 rounded-lg flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-foreground" />
                      </div>
                    </div>
                    <p className="text-3xl font-black">{formatPrice(stats.transferenciaTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="pb-4 border-b border-border bg-muted/5">
                    <CardTitle className="text-xl font-black uppercase tracking-wide">Top Productos</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {productChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={productChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                            itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center">
                        <p className="text-muted-foreground font-bold uppercase">Sin datos en productos</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="pb-4 border-b border-border bg-muted/5">
                    <CardTitle className="text-xl font-black uppercase tracking-wide">Ventas por Horario</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {timeSlotChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={timeSlotChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="slot" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                            itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                            formatter={(value) => formatPrice(value)}
                          />
                          <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center">
                        <p className="text-muted-foreground font-bold uppercase">Sin datos de horarios</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-24 text-center">
                <p className="text-xl font-bold uppercase text-muted-foreground">No hay datos para este período</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default SalesReportingPage;
