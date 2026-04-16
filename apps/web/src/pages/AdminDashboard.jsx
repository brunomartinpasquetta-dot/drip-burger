import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import { ORDER_STATUS, PAYMENT_STATUS, MEDALLION_LABELS } from '@/lib/orderConstants';
import Header from '@/components/Header.jsx';
import ProductForm from '@/components/ProductForm.jsx';
import ImageUploadButton from '@/components/ImageUploadButton.jsx';
import CustomerFormModal from '@/components/CustomerFormModal.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Send, Settings, BarChart3, ChefHat, CheckCircle2, Banknote, MapPin, Phone, Clock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const TIME_SLOTS = ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];

// Border color used as left accent on order cards — high-contrast for kitchen scanning
const STATUS_BORDER_COLOR = {
  [ORDER_STATUS.PENDING]: 'border-l-yellow-500',
  [ORDER_STATUS.COOKING]: 'border-l-blue-500',
  [ORDER_STATUS.READY]: 'border-l-cyan-500',
  [ORDER_STATUS.IN_TRANSIT]: 'border-l-orange-500',
  [ORDER_STATUS.COMPLETED]: 'border-l-green-500',
};

// ── Vista COCINA: selección de pedidos + agregación de productos ─
const BURGER_NAMES = ['BACON DRIP', 'OG DRIP', 'DIRTY DRIP'];

// Agrega items de una lista de orders en un productMap + papas total
const aggregateItems = (orderList) => {
  const productMap = {};
  let papasTotal = 0;
  orderList.forEach(order => {
    (order.items || []).forEach(item => {
      const name = item.productName;
      if (!productMap[name]) productMap[name] = { total: 0, byPatty: {} };
      productMap[name].total += item.quantity;
      productMap[name].byPatty[item.pattyCount] =
        (productMap[name].byPatty[item.pattyCount] || 0) + item.quantity;
      if (BURGER_NAMES.includes(name)) papasTotal += item.quantity;
    });
  });
  return { productMap, papasTotal };
};

// Calcula cantidad de papas fritas de un pedido (1 por burger, 0 por nuggets)
const orderPapasCount = (order) =>
  (order.items || []).reduce((sum, item) =>
    BURGER_NAMES.includes(item.productName) ? sum + item.quantity : sum, 0);

// Clasifica urgencia del pedido según horario de entrega vs hora actual
const getOrderUrgency = (order) => {
  if (!order.deliveryTimeSlot) return 'normal';
  const parts = String(order.deliveryTimeSlot).split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return 'normal';
  const slotTime = new Date();
  slotTime.setHours(h, m, 0, 0);
  const diffMin = (slotTime.getTime() - Date.now()) / 60000;
  if (diffMin < 0) return 'overdue';
  if (diffMin < 10) return 'soon';
  return 'normal';
};

const URGENCY_RING = {
  overdue: 'ring-2 ring-red-500/70',
  soon: 'ring-2 ring-amber-500/50',
  normal: '',
};

const KitchenView = ({ orders, onSendToKitchen, onMarkReady, isPending }) => {
  const [selectedSlot, setSelectedSlot] = useState('all');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showAggregated, setShowAggregated] = useState(false);

  // Re-render cada 30s para que la clasificación de urgencia se mantenga actualizada
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const slotFiltered = selectedSlot === 'all'
    ? orders
    : orders.filter(o => o.deliveryTimeSlot === selectedSlot);

  // Sort: horario ASC, luego creado ASC (más viejo primero dentro del mismo slot)
  const sortBySlotThenCreated = (a, b) => {
    const slotCmp = (a.deliveryTimeSlot || '').localeCompare(b.deliveryTimeSlot || '');
    if (slotCmp !== 0) return slotCmp;
    return new Date(a.created) - new Date(b.created);
  };

  const pendingOrders = slotFiltered
    .filter(o => !o.orderStatus || o.orderStatus === ORDER_STATUS.PENDING)
    .sort(sortBySlotThenCreated);

  const cookingOrders = slotFiltered
    .filter(o => o.orderStatus === ORDER_STATUS.COOKING)
    .sort(sortBySlotThenCreated);

  const readyOrders = slotFiltered
    .filter(o => o.orderStatus === ORDER_STATUS.READY)
    .sort(sortBySlotThenCreated);

  const pendingPapasTotal = pendingOrders.reduce((sum, o) => sum + orderPapasCount(o), 0);

  // Agregado de items que están ACTUALMENTE en preparación
  const { productMap: cookingMap, papasTotal: cookingPapas } = aggregateItems(cookingOrders);
  const hasCookingItems = Object.keys(cookingMap).length > 0;

  // Contadores por slot para el selector (sumando pendientes + en preparación + listos)
  const slotCounts = {};
  TIME_SLOTS.forEach(slot => {
    slotCounts[slot] = orders.filter(o =>
      o.deliveryTimeSlot === slot &&
      (!o.orderStatus || o.orderStatus === ORDER_STATUS.PENDING || o.orderStatus === ORDER_STATUS.COOKING || o.orderStatus === ORDER_STATUS.READY)
    ).length;
  });
  const totalActive = orders.filter(o =>
    !o.orderStatus || o.orderStatus === ORDER_STATUS.PENDING || o.orderStatus === ORDER_STATUS.COOKING || o.orderStatus === ORDER_STATUS.READY
  ).length;

  // Limpiar selección cuando cambia el slot o cuando un pedido deja de estar pendiente
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(pendingOrders.map(o => o.id));
      const next = new Set();
      prev.forEach(id => { if (validIds.has(id)) next.add(id); });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot, orders]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = pendingOrders.length > 0 && pendingOrders.every(o => selectedIds.has(o.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingOrders.map(o => o.id)));
    }
  };

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) return;
    await onSendToKitchen(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const TimeSlotPill = ({ slot }) => (
    <div className="inline-flex items-center gap-1 bg-muted text-foreground px-1.5 py-0.5 rounded shrink-0">
      <Clock className="w-3 h-3" />
      <span className="text-xs font-black tracking-tight leading-none">{slot || '—'}</span>
    </div>
  );

  const UrgencyBadge = ({ urgency }) => {
    if (urgency === 'overdue') {
      return <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide">Vencido</span>;
    }
    if (urgency === 'soon') {
      return <span className="bg-amber-500 text-black text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide">Pronto</span>;
    }
    return null;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Selector de turno — botones táctiles para uso en cocina */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedSlot('all')}
          className={`px-4 py-2 rounded-lg text-sm font-black uppercase border-2 transition-all ${selectedSlot === 'all' ? 'bg-primary text-black border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
        >
          Todos ({totalActive})
        </button>
        {TIME_SLOTS.map(slot => (
          <button
            key={slot}
            onClick={() => setSelectedSlot(slot)}
            className={`px-4 py-2 rounded-lg text-sm font-black border-2 transition-all ${selectedSlot === slot ? 'bg-primary text-black border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
          >
            {slot} {slotCounts[slot] > 0 && <span className="ml-1 text-xs">({slotCounts[slot]})</span>}
          </button>
        ))}
      </div>

      {/* ── 1. PENDIENTES DE COCINA (qué entra — prioridad visual) ── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-yellow-500 text-black px-2 py-1 rounded">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-black uppercase tracking-wide">Pendientes de cocina</span>
            </div>
            <span className="text-xs text-muted-foreground font-bold uppercase">
              {pendingOrders.length} {pendingOrders.length === 1 ? 'pedido' : 'pedidos'}
              {pendingPapasTotal > 0 && <> · <span className="text-yellow-400">🍟 {pendingPapasTotal} papas</span></>}
            </span>
          </div>
          {pendingOrders.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          )}
        </div>

        {pendingOrders.length === 0 ? (
          <div className="bg-card border border-border rounded-lg py-6 text-center">
            <p className="text-sm font-bold uppercase text-muted-foreground">Sin pedidos pendientes de cocina</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {pendingOrders.map(order => {
              const selected = selectedIds.has(order.id);
              const items = order.items || [];
              const isProcessing = isPending(order.id);
              const papasCount = orderPapasCount(order);
              const urgency = getOrderUrgency(order);
              const urgencyRing = URGENCY_RING[urgency];

              return (
                <div
                  key={order.id}
                  onClick={() => !isProcessing && toggleSelect(order.id)}
                  className={`cursor-pointer bg-card border rounded-lg overflow-hidden shadow-sm flex flex-col text-xs p-2 gap-1.5 transition-all ${
                    selected
                      ? 'border-primary border-2 ring-2 ring-primary/30'
                      : `border-border border-l-[4px] border-l-yellow-500 hover:border-primary/50 ${urgencyRing}`
                  } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selected ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
                      {selected && <CheckCircle2 className="w-4 h-4 text-black" />}
                    </div>
                    <TimeSlotPill slot={order.deliveryTimeSlot} />
                    <p className="text-base font-black uppercase tracking-tight leading-tight break-words min-w-0 flex-1">
                      {order.customerName || 'Sin nombre'}
                    </p>
                    <UrgencyBadge urgency={urgency} />
                  </div>

                  <div className="space-y-0.5 pl-8">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-baseline gap-1.5 text-sm leading-tight">
                        <span className="text-base font-black text-primary tabular-nums w-6 shrink-0">{item.quantity}×</span>
                        <span className="font-bold uppercase tracking-tight break-words">
                          {item.productName}
                          {item.pattyCount > 1 && <span className="text-muted-foreground font-medium"> · {MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}</span>}
                        </span>
                      </div>
                    ))}
                    {papasCount > 0 && (
                      <div className="flex items-baseline gap-1.5 text-sm leading-tight">
                        <span className="text-base font-black text-yellow-400 tabular-nums w-6 shrink-0">{papasCount}×</span>
                        <span className="font-bold uppercase tracking-tight text-yellow-400">🍟 Papas</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 2. EN PREPARACIÓN (qué estoy haciendo — acción primaria) ── */}
      {hasCookingItems && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 bg-blue-500 text-white px-2 py-1 rounded">
                <ChefHat className="w-3.5 h-3.5" />
                <span className="text-xs font-black uppercase tracking-wide">En preparación</span>
              </div>
              <span className="text-xs text-muted-foreground font-bold uppercase">
                {cookingOrders.length} {cookingOrders.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>
            <button
              onClick={() => setShowAggregated(v => !v)}
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {showAggregated ? '▾ Ocultar resumen' : '▸ Ver resumen total'}
            </button>
          </div>

          {/* Resumen agregado — colapsable, oculto por defecto */}
          {showAggregated && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {Object.entries(cookingMap).map(([productName, data]) => {
                const isBurger = BURGER_NAMES.includes(productName);
                return (
                  <div key={productName} className="bg-card border border-blue-500/30 border-l-[4px] border-l-blue-500 rounded-lg overflow-hidden">
                    <div className="bg-blue-500/10 border-b border-blue-500/20 px-3 py-1.5">
                      <p className="text-sm font-black uppercase tracking-tight text-blue-400">{productName}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      {isBurger
                        ? [1, 2, 3, 4, 5].map(p => data.byPatty[p] ? (
                            <div key={p} className="flex justify-between items-baseline">
                              <span className="text-xs font-bold text-foreground uppercase tracking-wide">{MEDALLION_LABELS[p]}</span>
                              <span className="text-2xl font-black text-white tabular-nums">× {data.byPatty[p]}</span>
                            </div>
                          ) : null)
                        : (
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold text-foreground uppercase tracking-wide">Total</span>
                            <span className="text-2xl font-black text-white tabular-nums">× {data.total}</span>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
              {cookingPapas > 0 && (
                <div className="bg-card border-2 border-yellow-500/40 rounded-lg overflow-hidden">
                  <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-3 py-1.5">
                    <p className="text-sm font-black uppercase tracking-tight text-yellow-400">🍟 Papas Fritas</p>
                  </div>
                  <div className="p-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">Porciones</span>
                      <span className="text-2xl font-black text-white tabular-nums">{cookingPapas}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cards individuales con botón "Listo" (target táctil 40px) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {cookingOrders.map(order => {
              const items = order.items || [];
              const isProcessing = isPending(order.id);
              const papasCount = orderPapasCount(order);
              const urgency = getOrderUrgency(order);
              const urgencyRing = URGENCY_RING[urgency];
              return (
                <div
                  key={order.id}
                  className={`bg-card border border-border border-l-[4px] border-l-blue-500 rounded-lg overflow-hidden flex flex-col text-xs p-2 gap-1.5 ${urgencyRing} ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <TimeSlotPill slot={order.deliveryTimeSlot} />
                    <p className="text-base font-black uppercase tracking-tight leading-tight break-words min-w-0 flex-1">
                      {order.customerName || 'Sin nombre'}
                    </p>
                    <UrgencyBadge urgency={urgency} />
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-baseline gap-1.5 text-sm leading-tight">
                        <span className="text-base font-black text-primary tabular-nums w-6 shrink-0">{item.quantity}×</span>
                        <span className="font-bold uppercase tracking-tight break-words">
                          {item.productName}
                          {item.pattyCount > 1 && <span className="text-muted-foreground font-medium"> · {MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}</span>}
                        </span>
                      </div>
                    ))}
                    {papasCount > 0 && (
                      <div className="flex items-baseline gap-1.5 text-sm leading-tight">
                        <span className="text-base font-black text-yellow-400 tabular-nums w-6 shrink-0">{papasCount}×</span>
                        <span className="font-bold uppercase tracking-tight text-yellow-400">🍟 Papas</span>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => onMarkReady(order.id)}
                    disabled={isProcessing}
                    className="w-full h-11 bg-cyan-500 hover:bg-cyan-600 text-black text-sm font-black uppercase tracking-wide shadow-sm border-0"
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    {isProcessing ? '...' : 'Listo'}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 3. LISTOS PARA ENVIAR (terminados por cocina, esperando delivery) ── */}
      {readyOrders.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-cyan-500 text-black px-2 py-1 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-black uppercase tracking-wide">Listos para enviar</span>
            </div>
            <span className="text-xs text-muted-foreground font-bold uppercase">
              {readyOrders.length} {readyOrders.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {readyOrders.map(order => {
              const items = order.items || [];
              const papasCount = orderPapasCount(order);
              const urgency = getOrderUrgency(order);
              const urgencyRing = URGENCY_RING[urgency];
              return (
                <div
                  key={order.id}
                  className={`bg-card border border-border border-l-[4px] border-l-cyan-500 rounded-lg overflow-hidden flex flex-col text-xs p-2 gap-1.5 ${urgencyRing}`}
                >
                  <div className="flex items-center gap-2">
                    <TimeSlotPill slot={order.deliveryTimeSlot} />
                    <p className="text-base font-black uppercase tracking-tight leading-tight break-words min-w-0 flex-1">
                      {order.customerName || 'Sin nombre'}
                    </p>
                    <UrgencyBadge urgency={urgency} />
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-baseline gap-1.5 text-sm leading-tight">
                        <span className="text-base font-black text-primary tabular-nums w-6 shrink-0">{item.quantity}×</span>
                        <span className="font-bold uppercase tracking-tight break-words">
                          {item.productName}
                          {item.pattyCount > 1 && <span className="text-muted-foreground font-medium"> · {MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}</span>}
                        </span>
                      </div>
                    ))}
                    {papasCount > 0 && (
                      <div className="flex items-baseline gap-1.5 text-sm leading-tight">
                        <span className="text-base font-black text-yellow-400 tabular-nums w-6 shrink-0">{papasCount}×</span>
                        <span className="font-bold uppercase tracking-tight text-yellow-400">🍟 Papas</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pendingOrders.length === 0 && !hasCookingItems && readyOrders.length === 0 && (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <ChefHat className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-xl font-bold uppercase text-muted-foreground">Sin pedidos activos</p>
        </div>
      )}

      {/* Sticky bottom action — solo visible cuando hay selección */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Button
            onClick={handleSendSelected}
            className="btn-primary h-12 px-6 shadow-2xl text-sm font-black uppercase tracking-wide"
          >
            <ChefHat className="mr-2 h-5 w-5" />
            Enviar {selectedIds.size} {selectedIds.size === 1 ? 'pedido' : 'pedidos'} a cocina
          </Button>
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
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [filters, setFilters] = useState({
    timeSlot: 'all',
    paymentMethod: 'all',
    status: 'all'
  });
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [slotOccupancy, setSlotOccupancy] = useState([]);
  const [maxMedallionsPerSlot, setMaxMedallionsPerSlot] = useState(20);
  const [activeTab, setActiveTab] = useState('orders');
  const navigate = useNavigate();

  const TAB_TITLES = {
    orders: 'Pedidos',
    kitchen: 'Cocina',
    products: 'Productos',
    customers: 'Clientes',
  };

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

  // Polling de ocupación por tanda cada 30s para los chips de cabecera
  useEffect(() => {
    let cancelled = false;
    const fetchOccupancy = async () => {
      try {
        const res = await apiServerClient.fetch('/slots/availability');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data?.slots)) setSlotOccupancy(data.slots);
        if (Number.isFinite(data?.maxMedallionsPerSlot)) {
          setMaxMedallionsPerSlot(data.maxMedallionsPerSlot);
        }
      } catch (err) {
        console.error('[AdminDashboard] slot occupancy failed:', err);
      }
    };
    fetchOccupancy();
    const id = setInterval(fetchOccupancy, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

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
    if (!requireAuth()) return;
    if (!window.confirm('¿Eliminar este cliente definitivamente?')) return;
    const key = `cust-${id}`;
    markPending(key, true);
    try {
      await pb.collection('users').delete(id, { requestKey: null });
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast.success('Cliente eliminado');
    } catch (error) {
      console.error('[handleDeleteCustomer] failed:', error?.response?.data || error);
      toast.error(`Error al eliminar el cliente (${error?.status || 'sin status'})`);
    } finally {
      markPending(key, false);
    }
  };

  // Bulk: mover pedidos Pendientes a "En preparación" (desde el tab Cocina)
  const handleSendToKitchen = async (orderIds) => {
    if (!requireAuth()) return;
    if (!orderIds || orderIds.length === 0) return;
    orderIds.forEach(id => markPending(id, true));
    try {
      const results = await Promise.all(
        orderIds.map(id =>
          pb.collection('orders').update(
            id,
            { orderStatus: ORDER_STATUS.COOKING },
            { requestKey: null }
          ).catch(err => ({ __error: true, id, err }))
        )
      );
      const failed = results.filter(r => r && r.__error);
      const succeeded = results.filter(r => r && !r.__error);
      if (succeeded.length > 0) {
        setOrders(prev => prev.map(o => {
          const updated = succeeded.find(s => s.id === o.id);
          return updated ? { ...o, ...updated } : o;
        }));
        toast.success(`${succeeded.length} ${succeeded.length === 1 ? 'pedido enviado' : 'pedidos enviados'} a cocina`);
      }
      if (failed.length > 0) {
        console.error('[handleSendToKitchen] failed for some orders:', failed);
        toast.error(`${failed.length} pedidos fallaron al enviarse a cocina`);
      }
    } finally {
      orderIds.forEach(id => markPending(id, false));
    }
  };

  // Cocina: marcar un pedido "En preparación" como "Listo" (terminado)
  const handleMarkReady = async (orderId) => {
    if (!requireAuth()) return;
    markPending(orderId, true);
    try {
      const updated = await pb.collection('orders').update(
        orderId,
        { orderStatus: ORDER_STATUS.READY },
        { requestKey: null }
      );
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      toast.success('Pedido marcado como Listo');
    } catch (error) {
      console.error('[handleMarkReady] failed:', { orderId, status: error?.status, data: error?.response?.data });
      toast.error(`Error al marcar como listo (${error?.status || 'sin status'})`);
    } finally {
      markPending(orderId, false);
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

    // Step 1: update order status in PocketBase (critical — if this fails, nothing else happens)
    let updated;
    try {
      updated = await pb.collection('orders').update(
        order.id,
        { orderStatus: ORDER_STATUS.IN_TRANSIT },
        { requestKey: null }
      );
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updated } : o));
    } catch (error) {
      console.error('[handleSendWhatsApp] order update failed:', { orderId: order.id, status: error?.status, data: error?.response?.data });
      toast.error(`Error al actualizar el pedido (${error?.status || 'sin status'})`);
      markPending(order.id, false);
      return;
    }

    // Step 2: send WhatsApp notification (best-effort — never blocks the order flow)
    let notificationState = 'failed'; // 'sent' | 'not_configured' | 'failed'
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
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.messageSent === true) {
          notificationState = 'sent';
        } else if (body.reason === 'Credenciales no configuradas') {
          notificationState = 'not_configured';
        }
      }
    } catch (e) {
      console.error('[handleSendWhatsApp] notification failed:', e);
    }

    if (notificationState === 'sent') {
      toast.success('Pedido marcado como En camino y WhatsApp enviado');
    } else if (notificationState === 'not_configured') {
      toast.warning('Pedido marcado En camino. WhatsApp no configurado.');
    } else {
      toast.warning('Pedido marcado En camino, pero falló la notificación WhatsApp');
    }
    markPending(order.id, false);
  };

  const filteredOrders = orders.filter(order => {
    if (filters.timeSlot !== 'all' && order.deliveryTimeSlot !== filters.timeSlot) return false;
    if (filters.status !== 'all' && order.orderStatus !== filters.status) return false;
    return true;
  });

  // Sort: slot ASC, then status (pendiente → cocinando → listo → enviado → entregado), then created ASC
  const statusOrder = {
    [ORDER_STATUS.PENDING]: 0,
    [ORDER_STATUS.COOKING]: 1,
    [ORDER_STATUS.READY]: 2,
    [ORDER_STATUS.IN_TRANSIT]: 3,
    [ORDER_STATUS.COMPLETED]: 4,
  };
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const slotA = a.deliveryTimeSlot || '99:99';
    const slotB = b.deliveryTimeSlot || '99:99';
    if (slotA !== slotB) return slotA.localeCompare(slotB);
    const sa = statusOrder[a.orderStatus] ?? 0;
    const sb = statusOrder[b.orderStatus] ?? 0;
    if (sa !== sb) return sa - sb;
    return new Date(a.created) - new Date(b.created);
  });

  const timeSlots = TIME_SLOTS;

  return (
    <>
      <Helmet><title>{TAB_TITLES[activeTab] || 'Admin'} - DRIP BURGER</title></Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2">
            {/* Header inline: volver a la izquierda, tabs centrados, acciones a la derecha */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 flex justify-start">
                <Button asChild variant="outline" size="sm" className="border-border h-8 px-2 text-[11px]">
                  <Link to="/"><ArrowLeft className="mr-1 h-3 w-3" />Volver</Link>
                </Button>
              </div>

              <TabsList className="bg-card border border-border p-0.5 h-auto flex gap-0">
                <TabsTrigger value="orders" className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:text-sm data-[state=active]:font-black data-[state=active]:px-3.5 data-[state=active]:py-1.5">
                  Pedidos {orders.filter(o => o.orderStatus === ORDER_STATUS.PENDING || !o.orderStatus).length > 0 && (
                    <span className="ml-1 bg-yellow-500 text-black text-[9px] rounded-full px-1 leading-3">
                      {orders.filter(o => o.orderStatus === ORDER_STATUS.PENDING || !o.orderStatus).length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="kitchen" className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:text-sm data-[state=active]:font-black data-[state=active]:px-3.5 data-[state=active]:py-1.5">
                  <ChefHat className="mr-1 h-3 w-3" />Cocina
                </TabsTrigger>
                <TabsTrigger value="products" className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:text-sm data-[state=active]:font-black data-[state=active]:px-3.5 data-[state=active]:py-1.5">Productos</TabsTrigger>
                <TabsTrigger value="customers" className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:text-sm data-[state=active]:font-black data-[state=active]:px-3.5 data-[state=active]:py-1.5">Clientes</TabsTrigger>
                <Link
                  to="/menu"
                  className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] inline-flex items-center justify-center rounded-sm text-foreground/70 hover:text-foreground hover:bg-muted/20 transition-colors border-l border-border/50 ml-0.5"
                  title="Ir al menú de clientes"
                >
                  Menú
                </Link>
              </TabsList>

              <div className="flex-1 flex justify-end gap-1.5">
                <Button asChild variant="outline" size="sm" className="border-border h-8 px-2 text-[11px]">
                  <Link to="/gestion/reportes"><BarChart3 className="mr-1 h-3 w-3" />Reportes</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="border-border h-8 px-2 text-[11px]">
                  <Link to="/gestion/config"><Settings className="mr-1 h-3 w-3" />Config</Link>
                </Button>
              </div>
            </div>

            {/* ── TAB: PEDIDOS ── */}
            <TabsContent value="orders" className="space-y-2">
              {/* Filtros inline: horarios/ocupación + estado */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-20 shrink-0">Horarios/Ocupación</span>
                  <button
                    onClick={() => setFilters({ ...filters, timeSlot: 'all' })}
                    className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wide border transition-colors ${
                      filters.timeSlot === 'all'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                    }`}
                  >
                    Todos
                  </button>
                  {timeSlots.map(slot => {
                    const info = slotOccupancy.find((s) => s.slot === slot);
                    const active = filters.timeSlot === slot;
                    // Color de ocupación (verde/amarillo/rojo) solo cuando no está activo;
                    // el botón activo mantiene el naranja primary del patrón general.
                    let inactiveCls = 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40';
                    if (info) {
                      if (info.full) {
                        inactiveCls = 'bg-red-500/20 border-red-500/40 text-red-500 hover:bg-red-500/30';
                      } else if (info.available <= 3) {
                        inactiveCls = 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/30';
                      } else if (info.usedMedallions > 0) {
                        inactiveCls = 'bg-green-500/20 border-green-500/40 text-green-500 hover:bg-green-500/30';
                      }
                    }
                    return (
                      <button
                        key={slot}
                        onClick={() => setFilters({ ...filters, timeSlot: slot })}
                        className={`px-3 py-1 rounded text-xs font-black tabular-nums border transition-colors ${
                          active ? 'bg-primary text-primary-foreground border-primary' : inactiveCls
                        }`}
                      >
                        {slot}
                        {info && (
                          <span className={`ml-1.5 ${active ? 'opacity-80' : 'opacity-90'}`}>
                            ·{info.usedMedallions}/{maxMedallionsPerSlot}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-20 shrink-0">Estado</span>
                  {[
                    { value: 'all', label: 'Todos' },
                    { value: ORDER_STATUS.PENDING, label: 'Pendiente' },
                    { value: ORDER_STATUS.COOKING, label: 'En preparación' },
                    { value: ORDER_STATUS.READY, label: 'Listo' },
                    { value: ORDER_STATUS.IN_TRANSIT, label: 'Enviado' },
                    { value: ORDER_STATUS.COMPLETED, label: 'Entregado' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilters({ ...filters, status: opt.value })}
                      className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wide border transition-colors ${
                        filters.status === opt.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}</div>
              ) : sortedOrders.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-16 text-center">
                    <p className="text-base font-bold uppercase text-muted-foreground">No hay pedidos</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {sortedOrders.map(order => {
                    const isPaid = order.paymentMethod === 'Transferencia' || order.paymentStatus === PAYMENT_STATUS.PAID;
                    const cashPending = order.paymentMethod === 'Efectivo' && !isPaid;
                    const borderCls = STATUS_BORDER_COLOR[order.orderStatus] || STATUS_BORDER_COLOR[ORDER_STATUS.PENDING];
                    const isProcessing = isPending(order.id);
                    const items = order.items || [];

                    return (
                      <div
                        key={order.id}
                        className={`bg-card border border-border border-l-[4px] ${borderCls} rounded-lg overflow-hidden shadow-sm flex flex-col text-xs p-2 gap-1.5`}
                      >
                        {/* Row 1: hora + nombre cliente + total */}
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

                        {/* Row 2: teléfono + dirección inline */}
                        <div className="flex items-center gap-2 flex-wrap text-[11px] leading-tight">
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="inline-flex items-center gap-1 font-bold hover:text-primary"
                          >
                            <Phone className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            <span>{order.customerPhone || '—'}</span>
                          </a>
                          <span className="inline-flex items-center gap-1 font-bold min-w-0">
                            <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{order.customerAddress || '—'}</span>
                          </span>
                        </div>

                        {/* Row 3: items (contenido del pedido) */}
                        <div className="space-y-0.5 flex-1">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-baseline gap-1 text-[11px] leading-tight">
                              <span className="text-xs font-black text-primary tabular-nums w-5 shrink-0">{item.quantity}×</span>
                              <span className="font-bold uppercase tracking-tight break-words">
                                {item.productName}
                                {item.pattyCount > 1 && <span className="text-muted-foreground font-medium"> · {MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}</span>}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Row 4: acciones (cobrar + enviar/finalizar) — debajo del contenido */}
                        <div className="flex items-stretch gap-1 pt-1 border-t border-border">
                          {/* COBRADO / COBRAR: acción de pago — misma consistencia filled que En Camino */}
                          <Button
                            onClick={() => handleMarkPaid(order.id)}
                            disabled={!cashPending || isProcessing}
                            size="sm"
                            className={`flex-1 h-10 shadow-sm text-[10px] font-black uppercase tracking-wide ${
                              cashPending
                                ? 'bg-green-500 hover:bg-green-600 text-black border-0'
                                : 'bg-green-500/20 text-green-400 border border-green-500/40 disabled:opacity-100'
                            }`}
                          >
                            <Banknote className="mr-1 h-3 w-3" />
                            {cashPending ? 'Cobrar' : '✓ Cobrado'}
                          </Button>

                          {/* PENDIENTE: esperando que cocina tome el pedido */}
                          {(!order.orderStatus || order.orderStatus === ORDER_STATUS.PENDING) && (
                            <div className="flex-1 h-10 flex items-center justify-center rounded-md bg-yellow-500/10 border border-yellow-500/30">
                              <span className="text-[10px] text-yellow-500 font-black uppercase tracking-wide">Esperando cocina</span>
                            </div>
                          )}
                          {/* EN PREPARACIÓN: cocinero está trabajando */}
                          {order.orderStatus === ORDER_STATUS.COOKING && (
                            <div className="flex-1 h-10 flex items-center justify-center rounded-md bg-blue-500/10 border border-blue-500/30">
                              <span className="text-[10px] text-blue-400 font-black uppercase tracking-wide">Cocinando...</span>
                            </div>
                          )}
                          {/* LISTO → En Camino + WA (la cocina ya terminó) */}
                          {order.orderStatus === ORDER_STATUS.READY && (
                            <Button
                              onClick={() => handleSendWhatsApp(order)}
                              disabled={isProcessing}
                              size="sm"
                              className="btn-primary flex-1 h-10 shadow-sm text-[10px] font-black uppercase tracking-wide"
                            >
                              <Send className="mr-1 h-3 w-3" />
                              {isProcessing ? '...' : 'En Camino'}
                            </Button>
                          )}
                          {order.orderStatus === ORDER_STATUS.IN_TRANSIT && (
                            <Button
                              onClick={() => handleUpdateOrderStatus(order.id, ORDER_STATUS.COMPLETED)}
                              disabled={isProcessing}
                              variant="outline"
                              size="sm"
                              className="flex-1 h-10 btn-secondary text-[10px] font-black uppercase tracking-wide"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {isProcessing ? '...' : 'Entregar'}
                            </Button>
                          )}
                          {order.orderStatus === ORDER_STATUS.COMPLETED && (
                            <div className="flex-1 h-10 flex items-center justify-center rounded-md bg-green-500/10 border border-green-500/30">
                              <span className="text-[10px] text-green-500 font-black uppercase tracking-wide">✓ Entregado</span>
                            </div>
                          )}
                        </div>
                      </div>
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
                : <KitchenView orders={orders} onSendToKitchen={handleSendToKitchen} onMarkReady={handleMarkReady} isPending={isPending} />
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
                                  <p>Cuádruple: <span className={`font-bold ${product.quadruplePrice > 0 ? 'text-primary' : 'text-muted-foreground/50'}`}>{product.quadruplePrice > 0 ? formatPrice(product.quadruplePrice) : '—'}</span></p>
                                  <p>Quíntuple: <span className={`font-bold ${product.quintuplePrice > 0 ? 'text-primary' : 'text-muted-foreground/50'}`}>{product.quintuplePrice > 0 ? formatPrice(product.quintuplePrice) : '—'}</span></p>
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

              <ProductForm
                product={selectedProduct}
                open={productFormOpen}
                onOpenChange={(v) => {
                  if (!v) {
                    setProductFormOpen(false);
                    setSelectedProduct(null);
                  }
                }}
                onSuccess={() => {
                  setProductFormOpen(false);
                  setSelectedProduct(null);
                  loadData();
                }}
              />
            </TabsContent>

            {/* ── TAB: CLIENTES ── */}
            <TabsContent value="customers" className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-4 rounded-xl border border-border">
                <h2 className="text-lg font-black uppercase tracking-wide">
                  Clientes <span className="text-muted-foreground text-sm">({customers.length})</span>
                </h2>
                <Button
                  onClick={() => { setSelectedCustomer(null); setCustomerFormOpen(true); }}
                  size="sm"
                  className="btn-primary h-9 px-3 text-xs font-black uppercase tracking-wide"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nuevo cliente
                </Button>
              </div>

              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
              ) : customers.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <p className="text-sm font-bold uppercase text-muted-foreground">Sin clientes registrados</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-muted/20 border-b border-border">
                          <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre</th>
                          <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</th>
                          <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono</th>
                          <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dirección</th>
                          <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {customers.map(customer => {
                          const fullName = customer.nombre_apellido || customer.name || '—';
                          const isProcessing = isPending(`cust-${customer.id}`);
                          return (
                            <tr key={customer.id} className={`hover:bg-muted/10 transition-colors ${isProcessing ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-2 font-bold uppercase text-xs">{fullName}</td>
                              <td className="px-4 py-2 text-xs text-muted-foreground">{customer.email || '—'}</td>
                              <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">{customer.telefono || customer.phone || '—'}</td>
                              <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate">{customer.direccion || customer.address || '—'}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-border h-7 px-2"
                                    onClick={() => { setSelectedCustomer(customer); setCustomerFormOpen(true); }}
                                    disabled={isProcessing}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-destructive/50 text-destructive hover:bg-destructive/10 h-7 px-2"
                                    onClick={() => handleDeleteCustomer(customer.id)}
                                    disabled={isProcessing}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <CustomerFormModal
                open={customerFormOpen}
                onOpenChange={setCustomerFormOpen}
                customer={selectedCustomer}
                onSuccess={() => { setSelectedCustomer(null); loadData(); }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
