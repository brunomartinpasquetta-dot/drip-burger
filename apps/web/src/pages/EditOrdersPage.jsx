import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { ORDER_STATUS, MEDALLION_LABELS } from '@/lib/orderConstants';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, XCircle, Clock, Phone, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TIME_SLOTS = ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];

const formatPrice = (price) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);

const EditOrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSlot, setFilterSlot] = useState('all');
  const [search, setSearch] = useState('');
  const [confirmOrder, setConfirmOrder] = useState(null); // order en confirmación de cancelación
  const [cancelling, setCancelling] = useState(false);

  const requireAuth = () => {
    if (!pb.authStore.isValid) {
      toast.error('Sesión expirada. Iniciá sesión de nuevo.');
      navigate('/login');
      return false;
    }
    return true;
  };

  const loadData = async () => {
    try {
      // Solo pedidos pendientes: son los únicos cancelables antes de preparación.
      const data = await pb.collection('orders').getFullList({
        filter: `orderStatus = "${ORDER_STATUS.PENDING}"`,
        sort: '-created',
        requestKey: null,
      });
      setOrders(data);
    } catch (err) {
      console.error('[EditOrdersPage] load failed:', err);
      toast.error('Error al cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCancel = async () => {
    if (!confirmOrder || !requireAuth()) return;
    setCancelling(true);
    try {
      await pb.collection('orders').update(
        confirmOrder.id,
        { orderStatus: ORDER_STATUS.CANCELLED },
        { requestKey: null }
      );
      setOrders((prev) => prev.filter((o) => o.id !== confirmOrder.id));
      toast.success(`Pedido ${confirmOrder.orderNumber || `#${confirmOrder.id}`} cancelado`);
      setConfirmOrder(null);
    } catch (err) {
      console.error('[EditOrdersPage] cancel failed:', err?.response?.data || err);
      toast.error(`Error al cancelar el pedido (${err?.status || 'sin status'})`);
    } finally {
      setCancelling(false);
    }
  };

  // Filtrado: slot + búsqueda por nombre o teléfono
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = orders.filter((o) => {
    if (filterSlot !== 'all' && o.deliveryTimeSlot !== filterSlot) return false;
    if (normalizedSearch) {
      const name = (o.customerName || '').toLowerCase();
      const phone = (o.customerPhone || '').toLowerCase();
      if (!name.includes(normalizedSearch) && !phone.includes(normalizedSearch)) return false;
    }
    return true;
  });

  return (
    <>
      <Helmet><title>Editar Pedidos - DRIP BURGER</title></Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2 space-y-3">
          {/* Header: Volver + título */}
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="border-border h-8 px-2 text-[11px]">
              <Link to="/gestion"><ArrowLeft className="mr-1 h-3 w-3" />Volver</Link>
            </Button>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Editar Pedidos
            </h1>
          </div>

          {/* Info banner */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium text-yellow-500 leading-snug">
              Solo pedidos en estado <span className="font-black">Pendiente</span> son cancelables.
              Al cancelar, los medallones vuelven a la capacidad de la tanda automáticamente.
            </p>
          </div>

          {/* Filtros: horario + búsqueda */}
          <div className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-16 shrink-0">Horario</span>
              <button
                onClick={() => setFilterSlot('all')}
                className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wide border transition-colors ${
                  filterSlot === 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                Todos
              </button>
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setFilterSlot(slot)}
                  className={`px-3 py-1 rounded text-xs font-black tabular-nums border transition-colors ${
                    filterSlot === slot
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-16 shrink-0">Cliente</span>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Nombre o teléfono"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 bg-background border-border text-foreground h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Lista de pedidos cancelables */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <p className="text-sm font-bold uppercase text-muted-foreground">
                  {orders.length === 0 ? 'No hay pedidos pendientes para cancelar' : 'Sin resultados para el filtro'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filtered.map((order) => {
                const items = order.items || [];
                return (
                  <div
                    key={order.id}
                    className="bg-card border border-border border-l-[4px] border-l-yellow-500 rounded-lg overflow-hidden shadow-sm flex flex-col text-xs p-2 gap-1.5"
                  >
                    {/* Row 1: hora + nombre + total */}
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1 bg-yellow-500 text-black px-1.5 py-0.5 rounded shrink-0">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs font-black tracking-tight leading-none">{order.deliveryTimeSlot || '—'}</span>
                      </div>
                      <p className="text-sm font-black uppercase tracking-tight leading-tight break-words min-w-0 flex-1">
                        {order.customerName || 'Sin nombre'}
                      </p>
                      <p className="text-sm font-black text-primary leading-none tabular-nums shrink-0">
                        {formatPrice(order.totalAmount)}
                      </p>
                    </div>

                    {/* Row 2: teléfono + orderNumber */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] leading-tight">
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="inline-flex items-center gap-1 font-bold hover:text-primary"
                      >
                        <Phone className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <span>{order.customerPhone || '—'}</span>
                      </a>
                      {order.orderNumber && (
                        <span className="text-muted-foreground font-mono tracking-tight">{order.orderNumber}</span>
                      )}
                    </div>

                    {/* Items */}
                    <div className="space-y-0.5 flex-1">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex items-baseline gap-1 text-[11px] leading-tight">
                          <span className="text-xs font-black text-primary tabular-nums w-5 shrink-0">{item.quantity}×</span>
                          <span className="font-bold uppercase tracking-tight break-words">
                            {item.productName}
                            {item.hasMedallions !== false && item.pattyCount > 1 && (
                              <span className="text-muted-foreground font-medium"> · {MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Acción: CANCELAR */}
                    <div className="pt-1 border-t border-border">
                      <Button
                        onClick={() => setConfirmOrder(order)}
                        size="sm"
                        className="w-full h-10 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide text-[11px] shadow-sm border-0"
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog de confirmación */}
      <Dialog open={!!confirmOrder} onOpenChange={(v) => { if (!v && !cancelling) setConfirmOrder(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirmar cancelación
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-foreground">
              {confirmOrder && (
                <>
                  ¿Estás seguro de cancelar el pedido{' '}
                  <span className="font-black text-primary">{confirmOrder.orderNumber || `#${confirmOrder.id}`}</span> de{' '}
                  <span className="font-black">{confirmOrder.customerName || 'cliente sin nombre'}</span>?
                  <br />
                  <span className="text-xs text-muted-foreground block mt-2">
                    Esta acción liberará los medallones de la tanda {confirmOrder.deliveryTimeSlot}.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOrder(null)}
              disabled={cancelling}
              className="border-border font-bold uppercase tracking-wide"
            >
              No, volver
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide border-0"
            >
              {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditOrdersPage;
