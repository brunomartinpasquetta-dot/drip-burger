import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import { ORDER_STATUS, PAYMENT_STATUS } from '@/lib/orderConstants';
import Header from '@/components/Header.jsx';
import ProductForm from '@/components/ProductForm.jsx';
import ImageUploadButton from '@/components/ImageUploadButton.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Send, Settings, BarChart3, ChefHat, CheckCircle2, Banknote, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const TIME_SLOTS = ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];

// ── Badge de estado de pedido ──────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    'Finalizado': 'bg-green-500/10 text-green-500 border-green-500/20',
    'En camino': 'bg-primary/20 text-primary border-primary/20',
    'Pendiente': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  };
  const cls = map[status] || map['Pendiente'];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${cls}`}>
      {status || 'Pendiente'}
    </span>
  );
};

// ── Badge de pago ─────────────────────────────────────────────────
const PaymentBadge = ({ method }) => {
  const isTransfer = method === 'Transferencia';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${isTransfer ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'
      }`}>
      {isTransfer ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
      {isTransfer ? 'Pagado' : 'Efectivo'}
    </span>
  );
};

// ── Vista COCINA: productos agrupados por turno ───────────────────
const BURGER_NAMES = ['BACON DRIP', 'OG DRIP', 'DIRTY DRIP'];
const MEDALLION_LABELS = { 1: 'Simple', 2: 'Doble', 3: 'Triple' };

const KitchenView = ({ orders }) => {
  const [selectedSlot, setSelectedSlot] = useState('all');

  const activeOrders = orders.filter(o => o.orderStatus !== ORDER_STATUS.COMPLETED);
  const filtered = selectedSlot === 'all'
    ? activeOrders
    : activeOrders.filter(o => o.deliveryTimeSlot === selectedSlot);

  // Agrupar por producto → por cantidad de medallones
  const productMap = {};
  let papasTotal = 0;
  filtered.forEach(order => {
    (order.items || []).forEach(item => {
      const name = item.productName;
      if (!productMap[name]) productMap[name] = { total: 0, byPatty: {} };
      productMap[name].total += item.quantity;
      productMap[name].byPatty[item.pattyCount] =
        (productMap[name].byPatty[item.pattyCount] || 0) + item.quantity;
      if (BURGER_NAMES.includes(name)) {
        papasTotal += item.quantity;
      }
    });
  });

  const slotCounts = {};
  TIME_SLOTS.forEach(slot => {
    slotCounts[slot] = activeOrders.filter(o => o.deliveryTimeSlot === slot).length;
  });

  const hasItems = Object.keys(productMap).length > 0;

  return (
    <div className="space-y-6">
      {/* Selector de turno */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedSlot('all')}
          className={`px-4 py-2 rounded-lg text-sm font-bold uppercase border transition-all ${selectedSlot === 'all' ? 'bg-primary text-black border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
        >
          Todos ({activeOrders.length})
        </button>
        {TIME_SLOTS.map(slot => (
          <button
            key={slot}
            onClick={() => setSelectedSlot(slot)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${selectedSlot === slot ? 'bg-primary text-black border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
          >
            {slot} {slotCounts[slot] > 0 && `(${slotCounts[slot]})`}
          </button>
        ))}
      </div>

      {!hasItems ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <ChefHat className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-xl font-bold uppercase text-muted-foreground">Sin pedidos activos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(productMap).map(([productName, data]) => {
            const isBurger = BURGER_NAMES.includes(productName);
            return (
              <Card key={productName} className="bg-card border-border overflow-hidden">
                <CardHeader className="bg-primary/10 border-b border-border py-4 px-5">
                  <CardTitle className="text-lg font-black uppercase tracking-tight text-primary">
                    {productName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {isBurger
                    ? [1, 2, 3].map(p => data.byPatty[p] ? (
                        <div key={p} className="flex justify-between items-baseline text-base font-bold">
                          <span className="text-foreground uppercase tracking-wide">{MEDALLION_LABELS[p]}</span>
                          <span className="text-2xl font-black text-white">× {data.byPatty[p]}</span>
                        </div>
                      ) : null)
                    : (
                      <div className="flex justify-between items-baseline text-base font-bold">
                        <span className="text-foreground uppercase tracking-wide">Total</span>
                        <span className="text-2xl font-black text-white">× {data.total}</span>
                      </div>
                    )}
                </CardContent>
              </Card>
            );
          })}

          {papasTotal > 0 && (
            <Card className="bg-card border-yellow-500/40 overflow-hidden">
              <CardHeader className="bg-yellow-500/10 border-b border-yellow-500/30 py-4 px-5">
                <CardTitle className="text-lg font-black uppercase tracking-tight text-yellow-400">
                  🍟 Papas Fritas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex justify-between items-baseline text-base font-bold">
                  <span className="text-foreground uppercase tracking-wide">Total</span>
                  <span className="text-2xl font-black text-white">{papasTotal} porciones</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────
const AdminDashboard = () => {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [filters, setFilters] = useState({
    timeSlot: 'all',
    paymentMethod: 'all',
    status: 'all'
  });
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const navigate = useNavigate();

  const isPending = (key) => pendingIds.has(key);
  const markPending = (key, pending) => {
    setPendingIds(prev => {
      const next = new Set(prev);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const requireAuth = () => {
    if (!pb.authStore.isValid) {
      toast.error('Sesión expirada. Iniciá sesión de nuevo.');
      navigate('/login');
      return false;
    }
    return true;
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [productsData, customersData, ordersData] = await Promise.all([
        pb.collection('products').getFullList({ sort: 'name', requestKey: null }),
        pb.collection('users').getFullList({ filter: 'role = "CUSTOMER"', sort: 'name', requestKey: null }),
        pb.collection('orders').getFullList({ sort: '-created', requestKey: null })
      ]);
      setProducts(productsData);
      setCustomers(customersData);
      setOrders(ordersData);
    } catch (error) {
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProductStatus = async (id, currentStatus) => {
    try {
      await pb.collection('products').update(id, { available: !currentStatus }, { requestKey: null });
      setProducts(products.map(p => p.id === id ? { ...p, available: !currentStatus } : p));
      toast.success(`Producto ${!currentStatus ? 'activado' : 'desactivado'}`);
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!requireAuth()) return;
    if (!window.confirm('¿Eliminar este producto definitivamente?')) return;
    const key = `prod-${id}`;
    markPending(key, true);
    try {
      await pb.collection('products').delete(id, { requestKey: null });
      toast.success('Producto eliminado');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar el producto');
    } finally {
      markPending(key, false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('¿Eliminar este cliente?')) return;
    try {
      await pb.collection('users').delete(id, { requestKey: null });
      toast.success('Cliente eliminado');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar el cliente');
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    if (!requireAuth()) return;
    markPending(orderId, true);
    try {
      const updated = await pb.collection('orders').update(orderId, { orderStatus: status }, { requestKey: null });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      toast.success(`Pedido actualizado a ${status}`);
    } catch (error) {
      console.error('[handleUpdateOrderStatus] failed:', { orderId, status: error?.status, data: error?.response?.data });
      toast.error(`Error al actualizar el pedido (${error?.status || 'sin status'})`);
    } finally {
      markPending(orderId, false);
    }
  };

  // Marcar como pagado manualmente (efectivo)
  const handleMarkPaid = async (orderId) => {
    if (!orderId) {
      toast.error('Error: ID del pedido no disponible');
      return;
    }
    if (!requireAuth()) return;
    markPending(orderId, true);
    try {
      const updated = await pb.collection('orders').update(
        orderId,
        { paymentStatus: PAYMENT_STATUS.PAID },
        { requestKey: null }
      );
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      toast.success('Pedido marcado como pagado');
    } catch (error) {
      console.error('[handleMarkPaid] failed:', {
        orderId,
        status: error?.status,
        url: error?.url,
        data: error?.response?.data,
      });
      toast.error(`Error al marcar como pagado (${error?.status || 'sin status'})`);
    } finally {
      markPending(orderId, false);
    }
  };

  const handleSendWhatsApp = async (order) => {
    if (!requireAuth()) return;
    markPending(order.id, true);
    try {
      const updated = await pb.collection('orders').update(order.id, { orderStatus: ORDER_STATUS.IN_TRANSIT }, { requestKey: null });
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updated } : o));
      let whatsappOk = true;
      try {
        const res = await apiServerClient.fetch('/orders/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            customerPhone: order.customerPhone,
            customerName: order.customerName?.split(' ')?.[0] || 'Cliente',
            deliveryTimeSlot: order.deliveryTimeSlot
          })
        });
        if (!res.ok) whatsappOk = false;
      } catch (e) {
        whatsappOk = false;
      }
      if (whatsappOk) {
        toast.success('Pedido marcado como En camino y WhatsApp enviado');
      } else {
        toast.warning('Pedido marcado En camino, pero falló la notificación WhatsApp');
      }
    } catch (error) {
      console.error('[handleSendWhatsApp] failed:', { orderId: order.id, status: error?.status, data: error?.response?.data });
      toast.error(`Error al actualizar el pedido (${error?.status || 'sin status'})`);
    } finally {
      markPending(order.id, false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filters.timeSlot !== 'all' && order.deliveryTimeSlot !== filters.timeSlot) return false;
    if (filters.paymentMethod !== 'all' && order.paymentMethod !== filters.paymentMethod) return false;
    if (filters.status !== 'all' && order.orderStatus !== filters.status) return false;
    return true;
  });

  const timeSlots = TIME_SLOTS;

  return (
    <>
      <Helmet><title>Admin - DRIP BURGER</title></Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <h1 className="text-5xl font-black uppercase tracking-tighter">
              Panel <span className="text-primary">Admin</span>
            </h1>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-border">
                <Link to="/gestion/reportes"><BarChart3 className="mr-2 h-4 w-4" />Reportes</Link>
              </Button>
              <Button asChild variant="outline" className="border-border">
                <Link to="/gestion/configuracion"><Settings className="mr-2 h-4 w-4" />Configuración</Link>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="orders" className="space-y-8">
            <TabsList className="bg-card border border-border p-1 h-auto flex flex-wrap">
              <TabsTrigger value="orders" className="font-bold uppercase tracking-wide py-3 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 sm:flex-none">
                Pedidos {orders.filter(o => o.orderStatus === ORDER_STATUS.PENDING || !o.orderStatus).length > 0 && (
                  <span className="ml-2 bg-yellow-500 text-black text-xs rounded-full px-2 py-0.5">
                    {orders.filter(o => o.orderStatus === ORDER_STATUS.PENDING || !o.orderStatus).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="kitchen" className="font-bold uppercase tracking-wide py-3 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 sm:flex-none">
                <ChefHat className="mr-2 h-4 w-4" />Cocina
              </TabsTrigger>
              <TabsTrigger value="products" className="font-bold uppercase tracking-wide py-3 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 sm:flex-none">Productos</TabsTrigger>
              <TabsTrigger value="customers" className="font-bold uppercase tracking-wide py-3 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 sm:flex-none">Clientes</TabsTrigger>
            </TabsList>

            {/* ── TAB: PEDIDOS ── */}
            <TabsContent value="orders" className="space-y-6">
              <Card className="bg-card border-border shadow-sm">
                <CardHeader><CardTitle className="text-xl font-black uppercase tracking-wide">Filtros</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Horario</Label>
                      <Select value={filters.timeSlot} onValueChange={(v) => setFilters({ ...filters, timeSlot: v })}>
                        <SelectTrigger className="bg-background border-border text-foreground font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="all" className="font-bold">Todos</SelectItem>
                          {timeSlots.map(slot => <SelectItem key={slot} value={slot} className="font-bold">{slot}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Pago</Label>
                      <Select value={filters.paymentMethod} onValueChange={(v) => setFilters({ ...filters, paymentMethod: v })}>
                        <SelectTrigger className="bg-background border-border text-foreground font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="all" className="font-bold">Todos</SelectItem>
                          <SelectItem value="Efectivo" className="font-bold">Efectivo</SelectItem>
                          <SelectItem value="Transferencia" className="font-bold">Transferencia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Estado</Label>
                      <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                        <SelectTrigger className="bg-background border-border text-foreground font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="all" className="font-bold">Todos</SelectItem>
                          <SelectItem value="Pendiente" className="font-bold">Pendiente</SelectItem>
                          <SelectItem value="En camino" className="font-bold">En camino</SelectItem>
                          <SelectItem value="Finalizado" className="font-bold">Finalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {loading ? (
                <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
              ) : filteredOrders.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-16 text-center">
                    <p className="text-xl font-bold uppercase text-muted-foreground">No hay pedidos</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map(order => {
                    const shipping = order.precio_envio_snapshot || 0;
                    const itemsTotal = (order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    const isPaid = order.paymentMethod === 'Transferencia' || order.paymentStatus === PAYMENT_STATUS.PAID;

                    return (
                      <Card key={order.id} className="bg-card border-border overflow-hidden shadow-sm">
                        {/* Header del pedido */}
                        <div className="bg-muted/10 p-4 border-b border-border flex flex-col md:flex-row md:justify-between items-start md:items-center gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-black uppercase">#{order.orderNumber}</h3>
                            <StatusBadge status={order.orderStatus} />
                            {/* Badge de pago */}
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase ${isPaid ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'
                              }`}>
                              {order.paymentMethod === 'Transferencia'
                                ? <><CreditCard className="w-3 h-3" />Pagado (Transferencia)</>
                                : isPaid
                                  ? <><Banknote className="w-3 h-3" />Pagado (Efectivo)</>
                                  : <><Banknote className="w-3 h-3" />Pendiente de cobro</>
                              }
                            </span>
                            <span className="text-xs text-muted-foreground font-bold bg-card px-2 py-1 rounded border border-border">
                              🕐 {order.deliveryTimeSlot}
                            </span>
                          </div>
                          <p className="font-black text-2xl text-primary">{formatPrice(order.totalAmount)}</p>
                        </div>

                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm mb-6">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Cliente</p>
                                  <p className="font-bold">{order.customerName}</p>
                                  <p className="text-muted-foreground">{order.customerPhone}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Dirección</p>
                                  <p className="font-bold">{order.customerAddress}</p>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Artículos</p>
                                <div className="space-y-2 bg-background p-4 rounded-xl border border-border">
                                  {(order.items || []).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                      <span className="font-bold uppercase">
                                        {item.productName} <span className="text-muted-foreground">({item.pattyCount}p) x{item.quantity}</span>
                                      </span>
                                      <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                                    </div>
                                  ))}
                                  <div className="border-t border-border pt-3 mt-2">
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-muted-foreground">Subtotal</span>
                                      <span className="font-bold">{formatPrice(itemsTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">Envío</span>
                                      {shipping === 0
                                        ? <span className="text-green-500 font-bold">Gratis 🛵</span>
                                        : <span className="font-bold">{formatPrice(shipping)}</span>
                                      }
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Acciones */}
                            <div className="flex flex-col gap-3 justify-start md:w-52 shrink-0 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-6">
                              {/* Marcar pagado manualmente si es efectivo y no está pagado */}
                              {order.paymentMethod === 'Efectivo' && !isPaid && (
                                <Button
                                  onClick={() => handleMarkPaid(order.id)}
                                  disabled={isPending(order.id)}
                                  variant="outline"
                                  className="w-full border-green-500/50 text-green-400 hover:bg-green-500/10"
                                >
                                  <Banknote className="mr-2 h-4 w-4" />
                                  {isPending(order.id) ? 'Procesando...' : 'Cobrado'}
                                </Button>
                              )}
                              {/* Enviar WhatsApp + marcar En camino */}
                              {(!order.orderStatus || order.orderStatus === ORDER_STATUS.PENDING) && (
                                <Button
                                  onClick={() => handleSendWhatsApp(order)}
                                  disabled={isPending(order.id)}
                                  className="btn-primary w-full shadow-md"
                                >
                                  <Send className="mr-2 h-4 w-4" />
                                  {isPending(order.id) ? 'Enviando...' : 'En Camino + WA'}
                                </Button>
                              )}
                              {/* Finalizar */}
                              {order.orderStatus === ORDER_STATUS.IN_TRANSIT && (
                                <Button
                                  onClick={() => handleUpdateOrderStatus(order.id, ORDER_STATUS.COMPLETED)}
                                  disabled={isPending(order.id)}
                                  variant="outline"
                                  className="btn-secondary w-full"
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  {isPending(order.id) ? 'Procesando...' : 'Finalizar'}
                                </Button>
                              )}
                              {order.orderStatus === ORDER_STATUS.COMPLETED && (
                                <span className="text-xs text-green-500 font-bold uppercase text-center">✓ Entregado</span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── TAB: COCINA ── */}
            <TabsContent value="kitchen" className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <ChefHat className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-black uppercase tracking-wide">Vista Cocina</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-4">Productos a preparar por turno. Solo pedidos activos (no finalizados).</p>
              {loading
                ? <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
                : <KitchenView orders={orders} />
              }
            </TabsContent>

            {/* ── TAB: PRODUCTOS ── */}
            <TabsContent value="products" className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
                <h2 className="text-2xl font-black uppercase tracking-wide">Menú</h2>
                <Button onClick={() => { setSelectedProduct(null); setProductFormOpen(true); }} className="btn-primary">
                  <Plus className="mr-2 h-5 w-5" />Nuevo Producto
                </Button>
              </div>

              {loading ? (
                <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-muted/20 border-b border-border">
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Foto</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Producto</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Precios</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Estado</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {products.map(product => (
                          <tr key={product.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-4">
                              <div className="w-12 h-12 bg-background rounded-lg overflow-hidden border border-border flex items-center justify-center">
                                {product.image
                                  ? <img src={pb.files.getUrl(product, product.image)} alt={product.name} className="w-full h-full object-cover" />
                                  : <span className="text-muted-foreground/30 text-xl">🍔</span>
                                }
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="font-black uppercase text-sm">{product.name}</p>
                              <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate">{product.description}</p>
                              {product.internalNote && (
                                <p className="text-xs text-yellow-500/70 mt-1">⚠ {product.internalNote}</p>
                              )}
                            </td>
                            <td className="p-4 text-sm">
                              {product.hasMedallions ? (
                                <div className="space-y-0.5">
                                  <p>Simple: <span className="font-bold text-primary">{formatPrice(product.simplePrice)}</span></p>
                                  <p>Doble: <span className="font-bold text-primary">{formatPrice(product.doublePrice)}</span></p>
                                  <p>Triple: <span className="font-bold text-primary">{formatPrice(product.triplePrice)}</span></p>
                                </div>
                              ) : (
                                <p className="font-bold text-primary">{formatPrice(product.fixedPrice)}</p>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <Switch
                                checked={product.available}
                                onCheckedChange={() => handleToggleProductStatus(product.id, product.available)}
                                className="data-[state=checked]:bg-green-500"
                              />
                              <p className={`text-xs font-bold mt-1 ${product.available ? 'text-green-500' : 'text-destructive'}`}>
                                {product.available ? 'Activo' : 'Inactivo'}
                              </p>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                <ImageUploadButton product={product} onUploadSuccess={loadData} />
                                <Button variant="outline" size="sm" className="border-border h-8"
                                  onClick={() => { setSelectedProduct(product); setProductFormOpen(true); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10 h-8"
                                  onClick={() => handleDeleteProduct(product.id)}
                                  disabled={isPending(`prod-${product.id}`)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {productFormOpen && (
                <ProductForm
                  product={selectedProduct}
                  onClose={() => { setProductFormOpen(false); setSelectedProduct(null); }}
                  onSuccess={() => { setProductFormOpen(false); setSelectedProduct(null); loadData(); }}
                />
              )}
            </TabsContent>

            {/* ── TAB: CLIENTES ── */}
            <TabsContent value="customers" className="space-y-6">
              <h2 className="text-2xl font-black uppercase tracking-wide bg-card p-6 rounded-2xl border border-border">
                Clientes registrados ({customers.length})
              </h2>
              {loading ? (
                <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
              ) : customers.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-16 text-center">
                    <p className="text-xl font-bold uppercase text-muted-foreground">Sin clientes registrados</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-muted/20 border-b border-border">
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacto</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {customers.map(customer => (
                          <tr key={customer.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-4 font-bold uppercase text-sm">{customer.nombre_apellido || customer.name}</td>
                            <td className="p-4 text-sm">
                              <p>{customer.email}</p>
                              <p className="text-muted-foreground">{customer.telefono}</p>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">{customer.direccion || '-'}</td>
                            <td className="p-4 text-center">
                              <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10 h-8"
                                onClick={() => handleDeleteCustomer(customer.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
