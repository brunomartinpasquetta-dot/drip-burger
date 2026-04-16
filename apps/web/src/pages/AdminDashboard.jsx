import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import { ORDER_STATUS, PAYMENT_STATUS, FORMA_PAGO, MEDALLION_LABELS } from '@/lib/orderConstants';
import Header from '@/components/Header.jsx';
import ProductForm from '@/components/ProductForm.jsx';
import ImageUploadButton from '@/components/ImageUploadButton.jsx';
import CustomerFormModal from '@/components/CustomerFormModal.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Send, ChefHat, CheckCircle2, Banknote, MapPin, Phone, Clock, ArrowLeft, XCircle, Wallet, DollarSign, Loader2, Minus, TrendingUp, TrendingDown, BarChart3, Settings, Utensils } from 'lucide-react';
import { SettingsContent } from './SettingsPage.jsx';
import { ReportsContent } from './SalesReportingPage.jsx';
import MenuPreviewContent from './admin/MenuPreviewContent.jsx';
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
  [ORDER_STATUS.CANCELLED]: 'border-l-gray-500',
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

// ── Caja: apertura/cierre de jornada ──────────────────────────────
const formatPriceArs = (value) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value || 0);

// Devuelve la hora actual en zona Argentina (UTC-3) como "HH:mm".
const horaActualAr = () => {
  const now = new Date();
  const arMs = now.getTime() + (-3 * 60 * 60 * 1000) - now.getTimezoneOffset() * 60 * 1000;
  const arDate = new Date(arMs);
  const hh = String(arDate.getHours()).padStart(2, '0');
  const mm = String(arDate.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

// Devuelve la fecha actual en AR como "YYYY-MM-DD HH:mm:ss.sssZ" para PB DateField.
const fechaAhoraIso = () => new Date().toISOString();

// Formatea una fecha ISO a "HH:mm" en AR. Tolera inputs falsy.
const timeOfDayAr = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const ar = new Date(d.getTime() + (-3 * 60 * 60 * 1000) - d.getTimezoneOffset() * 60 * 1000);
    return `${String(ar.getHours()).padStart(2, '0')}:${String(ar.getMinutes()).padStart(2, '0')}`;
  } catch (e) {
    return '—';
  }
};

const CajaCard = ({ currentUserId, jornada, jornadaLoading, onJornadaChange }) => {
  const [jornadaOrders, setJornadaOrders] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const [montoInicial, setMontoInicial] = useState('');
  const [opening, setOpening] = useState(false);

  // Modal de cierre
  const [closeOpen, setCloseOpen] = useState(false);
  const [montoCierre, setMontoCierre] = useState('');
  const [closing, setClosing] = useState(false);

  // Modal de movimiento (ingreso/egreso)
  const [movOpen, setMovOpen] = useState(null); // 'ingreso' | 'egreso' | null
  const [movMonto, setMovMonto] = useState('');
  const [movMotivo, setMovMotivo] = useState('');
  const [movSaving, setMovSaving] = useState(false);

  // ── Carga de pedidos + movimientos scoped a la jornada activa ──
  useEffect(() => {
    let cancelled = false;
    if (!jornada) {
      setJornadaOrders([]);
      setMovimientos([]);
      return () => { cancelled = true; };
    }
    const loadData = async () => {
      try {
        const [ordsRes, movsRes] = await Promise.all([
          pb.collection('orders').getFullList({
            filter: `jornadaId = "${jornada.id}"`,
            requestKey: null,
          }),
          pb.collection('movimientos_caja').getFullList({
            filter: `jornadaId = "${jornada.id}"`,
            sort: '-created',
            requestKey: null,
          }),
        ]);
        if (cancelled) return;
        setJornadaOrders(ordsRes);
        setMovimientos(movsRes);
      } catch (err) {
        console.error('[CajaCard] data load failed:', err);
      }
    };
    loadData();
    const id = setInterval(loadData, 30000);
    return () => { cancelled = true; clearInterval(id); };
    // Depende solo del id: evita re-fetches cuando el parent refetchea jornada
    // y devuelve el mismo record con referencia nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jornada?.id]);

  // ── Cálculos de totales ────────────────────────────────────────
  const activeOrders = jornadaOrders.filter((o) => o.orderStatus !== ORDER_STATUS.CANCELLED);
  const cancelledOrders = jornadaOrders.filter((o) => o.orderStatus === ORDER_STATUS.CANCELLED);
  const cobrosEfectivo = activeOrders
    .filter((o) => o.paymentMethod === FORMA_PAGO.CASH && o.paymentStatus === PAYMENT_STATUS.PAID)
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const cobrosTransferencia = activeOrders
    .filter((o) => o.paymentMethod === FORMA_PAGO.TRANSFER && o.paymentStatus === PAYMENT_STATUS.PAID)
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const ingresosManuales = movimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
  const egresosManuales = movimientos
    .filter((m) => m.tipo === 'egreso')
    .reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
  const fondoInicial = Number(jornada?.montoInicial) || 0;
  const efectivoEsperado = fondoInicial + cobrosEfectivo + ingresosManuales - egresosManuales;
  const totalPedidosJornada = activeOrders.length;
  const pedidosCancelados = cancelledOrders.length;
  const montoCancelados = cancelledOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  // Cuadre en vivo dentro del modal de cierre.
  const montoCierreNum = Number(montoCierre) || 0;
  const cuadre = montoCierreNum - efectivoEsperado;

  // ── Handlers ───────────────────────────────────────────────────
  const handleOpen = async () => {
    const monto = Math.max(0, Number(montoInicial) || 0);
    if (montoInicial === '' || Number.isNaN(Number(montoInicial))) {
      toast.error('Ingresá un monto inicial válido');
      return;
    }
    setOpening(true);
    try {
      const data = {
        fecha: fechaAhoraIso(),
        horaApertura: horaActualAr(),
        montoInicial: monto,
        estado: 'abierta',
      };
      if (currentUserId) data.adminId = currentUserId;
      const rec = await pb.collection('jornadas').create(data, { requestKey: null });

      // Adoptar pedidos huérfanos del día: orders sin jornadaId creados
      // desde las 00:00 AR. Evita que pedidos que entraron antes de abrir
      // la jornada queden afuera de la caja.
      try {
        const startAr = new Date();
        startAr.setHours(0, 0, 0, 0);
        const startStr = startAr.toISOString().replace('T', ' ');
        const orphans = await pb.collection('orders').getFullList({
          filter: `jornadaId = "" && created >= "${startStr}"`,
          requestKey: null,
        });
        if (orphans.length > 0) {
          await Promise.all(orphans.map((o) =>
            pb.collection('orders').update(o.id, { jornadaId: rec.id }, { requestKey: null })
          ));
          toast.success(`Jornada iniciada · ${orphans.length} ${orphans.length === 1 ? 'pedido huérfano asociado' : 'pedidos huérfanos asociados'}`);
        } else {
          toast.success('Jornada iniciada');
        }
      } catch (adoptErr) {
        console.error('[CajaCard] orphan adoption failed:', adoptErr);
        toast.success('Jornada iniciada');
      }

      setMontoInicial('');
      if (onJornadaChange) onJornadaChange();
    } catch (err) {
      console.error('[CajaCard] open failed:', err?.response?.data || err);
      toast.error(`Error al iniciar jornada (${err?.status || 'sin status'})`);
    } finally {
      setOpening(false);
    }
  };

  const handleClose = async () => {
    if (!jornada) return;
    if (montoCierre === '' || Number.isNaN(Number(montoCierre))) {
      toast.error('Ingresá el monto de cierre');
      return;
    }
    setClosing(true);
    try {
      await pb.collection('jornadas').update(
        jornada.id,
        {
          estado: 'cerrada',
          horaCierre: horaActualAr(),
          montoCierre: Math.max(0, montoCierreNum),
          totalEfectivo: cobrosEfectivo,
          totalTransferencias: cobrosTransferencia,
          totalPedidos: totalPedidosJornada,
          pedidosCancelados,
          montoCancelados,
          efectivoEsperado,
          cuadre,
        },
        { requestKey: null }
      );
      setMontoCierre('');
      setCloseOpen(false);
      toast.success('Jornada cerrada correctamente');
      if (onJornadaChange) onJornadaChange();
    } catch (err) {
      console.error('[CajaCard] close failed:', err?.response?.data || err);
      toast.error(`Error al cerrar jornada (${err?.status || 'sin status'})`);
    } finally {
      setClosing(false);
    }
  };

  const openMovModal = (tipo) => {
    setMovOpen(tipo);
    setMovMonto('');
    setMovMotivo('');
  };

  const handleMovSave = async () => {
    if (!jornada || !movOpen) return;
    const monto = Number(movMonto);
    if (!monto || Number.isNaN(monto) || monto <= 0) {
      toast.error('Ingresá un monto válido mayor a 0');
      return;
    }
    if (!movMotivo.trim()) {
      toast.error('Ingresá el motivo');
      return;
    }
    setMovSaving(true);
    try {
      const data = {
        jornadaId: jornada.id,
        tipo: movOpen,
        monto,
        motivo: movMotivo.trim(),
      };
      if (currentUserId) data.adminId = currentUserId;
      const created = await pb.collection('movimientos_caja').create(data, { requestKey: null });
      setMovimientos((prev) => [created, ...prev]);
      toast.success(movOpen === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado');
      setMovOpen(null);
    } catch (err) {
      console.error('[CajaCard] movimiento failed:', err?.response?.data || err);
      toast.error(`Error al registrar el movimiento (${err?.status || 'sin status'})`);
    } finally {
      setMovSaving(false);
    }
  };

  if (jornadaLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  // ── Estado A: sin jornada abierta ──────────────────────────────
  if (!jornada) {
    return (
      <div className="max-w-md mx-auto bg-card border border-border border-l-[6px] border-l-yellow-500 rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 text-center">
          <Wallet className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight mb-1">No hay jornada abierta</h3>
          <p className="text-xs text-muted-foreground font-medium mb-5">
            Ingresá el fondo de caja inicial y abrí la jornada para que los pedidos queden asociados.
          </p>
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
              Monto inicial (fondo de caja)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
              <Input
                type="number"
                min="0"
                step="1"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                placeholder="0"
                className="pl-7 bg-background border-border text-foreground h-11 text-base font-black tabular-nums"
              />
            </div>
          </div>
          <Button
            onClick={handleOpen}
            disabled={opening}
            className="w-full mt-4 btn-primary h-12 text-sm font-black uppercase tracking-wide shadow-sm"
          >
            {opening ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Iniciando...</>
            ) : (
              <><DollarSign className="mr-2 h-5 w-5" />Iniciar Jornada</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Estado B: jornada abierta ──────────────────────────────────
  const SummaryRow = ({ label, value, colorCls, signo }) => (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground font-bold uppercase tracking-wider">{label}</span>
      <span className={`font-black tabular-nums ${colorCls || 'text-foreground'}`}>
        {signo}{formatPriceArs(value)}
      </span>
    </div>
  );

  return (
    <>
      <div className="max-w-md mx-auto bg-card border border-border border-l-[6px] border-l-green-500 rounded-lg overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-500 border border-green-500/40 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
              <span className="text-[8px]">●</span>
              Jornada abierta
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Inicio <span className="text-foreground font-black tabular-nums">{jornada.horaApertura || '—'}</span>
            </p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Fondo <span className="text-primary font-black tabular-nums">{formatPriceArs(jornada.montoInicial)}</span>
            </p>
          </div>
        </div>

        {/* Resumen en vivo */}
        <div className="px-5 py-4 space-y-2 bg-background/30">
          <SummaryRow label="Cobros efectivo" value={cobrosEfectivo} colorCls="text-green-500" signo="+ " />
          <SummaryRow label="Cobros transferencia" value={cobrosTransferencia} colorCls="text-blue-400" signo="" />
          <SummaryRow label="Ingresos manuales" value={ingresosManuales} colorCls="text-green-500" signo="+ " />
          <SummaryRow label="Egresos manuales" value={egresosManuales} colorCls="text-red-500" signo="− " />
          <div className="border-t border-border pt-2 flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Efectivo en caja</span>
            <span className="text-lg font-black text-primary tabular-nums">{formatPriceArs(efectivoEsperado)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 pt-1 text-[11px] text-muted-foreground">
            <span className="font-medium">Pedidos: <span className="text-foreground font-black">{totalPedidosJornada}</span></span>
            {pedidosCancelados > 0 && (
              <span className="font-medium">Cancelados: <span className="text-red-500 font-black">{pedidosCancelados}</span></span>
            )}
          </div>
        </div>

        {/* Botones de movimiento */}
        <div className="px-5 py-3 border-t border-border grid grid-cols-2 gap-2">
          <Button
            onClick={() => openMovModal('ingreso')}
            className="h-10 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-wide text-xs border-0"
          >
            <Plus className="mr-1 h-4 w-4" />Ingreso
          </Button>
          <Button
            onClick={() => openMovModal('egreso')}
            className="h-10 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide text-xs border-0"
          >
            <Minus className="mr-1 h-4 w-4" />Egreso
          </Button>
        </div>

        {/* Lista de movimientos */}
        <div className="px-5 py-3 border-t border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Movimientos</p>
          {movimientos.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/70 font-medium italic">
              Sin movimientos registrados
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {movimientos.map((m) => {
                const isIngreso = m.tipo === 'ingreso';
                return (
                  <div key={m.id} className="flex items-center gap-2 text-[11px] leading-tight">
                    <span className="text-muted-foreground tabular-nums w-10 shrink-0">{timeOfDayAr(m.created)}</span>
                    <span className={`font-black tabular-nums w-20 shrink-0 ${isIngreso ? 'text-green-500' : 'text-red-500'}`}>
                      {isIngreso ? '+' : '−'}{formatPriceArs(m.monto)}
                    </span>
                    <span className="text-sm font-medium text-foreground/90 break-words min-w-0 flex-1">
                      {m.motivo || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Botón cerrar jornada */}
        <div className="px-5 py-3 border-t border-border">
          <Button
            onClick={() => { setMontoCierre(''); setCloseOpen(true); }}
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide text-sm shadow-sm border-0"
          >
            <XCircle className="mr-2 h-5 w-5" />
            Cerrar Jornada
          </Button>
        </div>
      </div>

      {/* Modal: cierre con resumen completo + cuadre en vivo */}
      <Dialog open={closeOpen} onOpenChange={(v) => { if (!v && !closing) setCloseOpen(false); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Cierre de jornada
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs text-muted-foreground">
              Contá el efectivo y ajustá el monto si hace falta. El cuadre se calcula en vivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Breakdown */}
            <div className="bg-background border border-border rounded-md p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground font-bold uppercase tracking-wider">Fondo inicial</span>
                <span className="font-black tabular-nums text-foreground">{formatPriceArs(fondoInicial)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground font-bold uppercase tracking-wider">+ Cobros efectivo</span>
                <span className="font-black tabular-nums text-green-500">+ {formatPriceArs(cobrosEfectivo)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground font-bold uppercase tracking-wider">+ Ingresos manuales</span>
                <span className="font-black tabular-nums text-green-500">+ {formatPriceArs(ingresosManuales)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground font-bold uppercase tracking-wider">− Egresos manuales</span>
                <span className="font-black tabular-nums text-red-500">− {formatPriceArs(egresosManuales)}</span>
              </div>
              <div className="border-t border-border pt-1.5 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Efectivo esperado</span>
                <span className="font-black tabular-nums text-primary text-base">{formatPriceArs(efectivoEsperado)}</span>
              </div>
            </div>

            {/* Info extra */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-background border border-border rounded-md p-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Transferencias</p>
                <p className="font-black tabular-nums text-blue-400">{formatPriceArs(cobrosTransferencia)}</p>
              </div>
              <div className="bg-background border border-border rounded-md p-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Pedidos</p>
                <p className="font-black tabular-nums">{totalPedidosJornada}</p>
              </div>
              <div className="bg-background border border-border rounded-md p-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Cancelados</p>
                <p className={`font-black tabular-nums ${pedidosCancelados > 0 ? 'text-red-500' : ''}`}>{pedidosCancelados}</p>
              </div>
            </div>

            {/* Input efectivo real */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                ¿Cuánto efectivo hay en caja?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={montoCierre}
                  onChange={(e) => setMontoCierre(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="pl-7 bg-background border-border text-foreground h-11 text-base font-black tabular-nums"
                />
              </div>
            </div>

            {/* Cuadre en vivo */}
            {montoCierre !== '' && !Number.isNaN(Number(montoCierre)) && (
              <div className={`rounded-md p-3 border text-center ${
                cuadre === 0
                  ? 'bg-green-500/15 border-green-500/40'
                  : cuadre > 0
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/40'
              }`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Diferencia</p>
                {cuadre === 0 ? (
                  <p className="font-black text-sm text-green-500 uppercase tracking-wide">Cuadra perfecto ✓</p>
                ) : (
                  <p className={`font-black text-lg tabular-nums ${cuadre > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {cuadre > 0 ? '+' : '−'}{formatPriceArs(Math.abs(cuadre))}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setCloseOpen(false)}
              disabled={closing}
              className="border-border font-bold uppercase tracking-wide"
            >
              Volver
            </Button>
            <Button
              onClick={handleClose}
              disabled={closing}
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide border-0"
            >
              {closing ? 'Cerrando...' : 'Cerrar Jornada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: registro de ingreso/egreso */}
      <Dialog open={!!movOpen} onOpenChange={(v) => { if (!v && !movSaving) setMovOpen(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${movOpen === 'ingreso' ? 'text-green-500' : 'text-red-500'}`}>
              {movOpen === 'ingreso' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {movOpen === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs text-muted-foreground">
              {movOpen === 'ingreso'
                ? 'Dinero que entra a caja fuera de pedidos (ej: deuda cobrada).'
                : 'Dinero que sale de caja fuera de pedidos (ej: pago repartidor, compras).'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={movMonto}
                  onChange={(e) => setMovMonto(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="pl-7 bg-background border-border text-foreground h-11 text-base font-black tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Motivo</label>
              <Input
                type="text"
                value={movMotivo}
                onChange={(e) => setMovMotivo(e.target.value)}
                placeholder={movOpen === 'ingreso' ? 'Motivo del ingreso' : 'Motivo del egreso'}
                className="bg-background border-border text-foreground h-10 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setMovOpen(null)}
              disabled={movSaving}
              className="border-border font-bold uppercase tracking-wide"
            >
              Volver
            </Button>
            <Button
              onClick={handleMovSave}
              disabled={movSaving}
              className={`font-black uppercase tracking-wide border-0 text-white ${movOpen === 'ingreso' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {movSaving ? 'Guardando...' : movOpen === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [jornadaLoading, setJornadaLoading] = useState(true);
  const navigate = useNavigate();

  const TAB_TITLES = {
    orders: 'Pedidos',
    kitchen: 'Cocina',
    products: 'Productos',
    customers: 'Clientes',
    caja: 'Caja',
    menu: 'Menú',
    reportes: 'Reportes',
    config: 'Configuración',
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

  // Gate: bloquea operaciones sobre pedidos si no hay jornada abierta.
  // Retorna true si se puede operar, false si no (y muestra toast).
  const requireJornada = () => {
    if (!jornadaActiva) {
      toast.error('Primero iniciá la jornada desde la tab Caja');
      return false;
    }
    return true;
  };

  useEffect(() => { loadData(); }, []);

  // Polling de jornada activa cada 30s para reaccionar a apertura/cierre
  // (posiblemente desde otro dispositivo/admin concurrente).
  const refetchJornada = async () => {
    try {
      const rec = await pb.collection('jornadas').getFirstListItem('estado = "abierta"', { requestKey: null });
      setJornadaActiva(rec);
    } catch (err) {
      if (err?.status === 404) {
        setJornadaActiva(null);
      } else {
        console.error('[AdminDashboard] jornada fetch failed:', err);
      }
    } finally {
      setJornadaLoading(false);
    }
  };
  useEffect(() => {
    refetchJornada();
    const id = setInterval(refetchJornada, 30000);
    return () => clearInterval(id);
  }, []);

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
    if (!requireJornada()) return;
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
    if (!requireJornada()) return;
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
    if (!requireJornada()) return;
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
    if (!requireJornada()) return;
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
    if (!requireJornada()) return;
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

  // Inicio del día local en AR (las 00:00 locales del navegador del admin).
  // Se usa para filtrar "pedidos de hoy" cuando no hay jornada abierta, y para
  // detectar huérfanos al abrir la primera jornada de la jornada nocturna.
  const todayStartMs = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();

  const filteredOrders = orders.filter(order => {
    // Scope por jornada: con jornada abierta → solo pedidos de esa jornada
    // (el hook ya les asigna jornadaId). Sin jornada → pedidos huérfanos del
    // día (los que entraron esperando que el admin abra caja).
    if (jornadaActiva) {
      if (order.jornadaId !== jornadaActiva.id) return false;
    } else {
      if (order.jornadaId) return false; // pedido de otra jornada (cerrada), no se muestra
      const createdMs = order.created ? new Date(order.created).getTime() : 0;
      if (createdMs < todayStartMs) return false;
    }
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
                <TabsTrigger value="caja" className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:text-sm data-[state=active]:font-black data-[state=active]:px-3.5 data-[state=active]:py-1.5">
                  <Wallet className="mr-1 h-3 w-3" />Caja
                </TabsTrigger>
                <TabsTrigger value="menu" className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:text-sm data-[state=active]:font-black data-[state=active]:px-3.5 data-[state=active]:py-1.5">
                  <Utensils className="mr-1 h-3 w-3" />Menú
                </TabsTrigger>
                <TabsTrigger value="reportes" className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:text-sm data-[state=active]:font-black data-[state=active]:px-3.5 data-[state=active]:py-1.5">
                  <BarChart3 className="mr-1 h-3 w-3" />Reportes
                </TabsTrigger>
                <TabsTrigger value="config" className="font-bold uppercase tracking-wide py-1 px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:text-sm data-[state=active]:font-black data-[state=active]:px-3.5 data-[state=active]:py-1.5">
                  <Settings className="mr-1 h-3 w-3" />Config
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 flex justify-end gap-1.5">
                {activeTab === 'orders' && (
                  <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide h-8 px-2 text-[11px] border-0">
                    <Link to="/gestion/editar-pedidos"><XCircle className="mr-1 h-3 w-3" />Editar Pedidos</Link>
                  </Button>
                )}
              </div>
            </div>

            {/* ── TAB: PEDIDOS ── */}
            <TabsContent value="orders" className="space-y-2">
              {/* Banner sin jornada: bloquea operar pedidos */}
              {!jornadaLoading && !jornadaActiva && (
                <div className="sticky top-0 z-10 bg-primary/20 border border-primary/40 rounded-lg px-3 py-2 flex items-start gap-2 shadow-sm backdrop-blur">
                  <Wallet className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-primary">
                      No hay jornada abierta
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Los pedidos no se pueden procesar. Iniciá la jornada desde la tab{' '}
                      <button
                        onClick={() => setActiveTab('caja')}
                        className="underline font-black uppercase text-primary hover:text-primary/80"
                      >
                        Caja
                      </button>.
                    </p>
                  </div>
                </div>
              )}

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
                    // La info de ocupación solo se considera si hay jornada abierta.
                    // Sin jornada, los botones de slot mantienen la funcionalidad de
                    // filtro pero no muestran colores ni contadores de medallones.
                    const info = jornadaActiva ? slotOccupancy.find((s) => s.slot === slot) : null;
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
                    const isCancelled = order.orderStatus === ORDER_STATUS.CANCELLED;
                    const blockedNoJornada = !jornadaActiva && !isCancelled;
                    const items = order.items || [];

                    return (
                      <div
                        key={order.id}
                        className={`bg-card border border-border border-l-[4px] ${borderCls} rounded-lg overflow-hidden shadow-sm flex flex-col text-xs p-2 gap-1.5 ${isCancelled ? 'opacity-60' : ''} ${blockedNoJornada ? 'opacity-50' : ''}`}
                      >
                        {/* Row 1: hora + nombre cliente + total */}
                        <div className="flex items-center gap-2">
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded shrink-0 ${isCancelled ? 'bg-gray-500 text-white' : 'bg-yellow-500 text-black'}`}>
                            <Clock className="w-3 h-3" />
                            <span className="text-xs font-black tracking-tight leading-none">{order.deliveryTimeSlot || '—'}</span>
                          </div>
                          <p className={`text-sm font-black uppercase tracking-tight leading-tight break-words min-w-0 flex-1 ${isCancelled ? 'line-through' : ''}`}>
                            {order.customerName || 'Sin nombre'}
                          </p>
                          <p className={`text-sm font-black leading-none tabular-nums shrink-0 ${isCancelled ? 'text-muted-foreground line-through' : 'text-primary'}`}>
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
                        <div className={`space-y-0.5 flex-1 ${isCancelled ? 'line-through' : ''}`}>
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

                        {/* Row 4: estado CANCELADO (sin acciones) o acciones normales */}
                        {isCancelled ? (
                          <div className="flex items-stretch pt-1 border-t border-border">
                            <div className="flex-1 h-10 flex items-center justify-center rounded-md bg-red-500/15 border border-red-500/40">
                              <XCircle className="w-4 h-4 text-red-500 mr-1.5" />
                              <span className="text-[11px] text-red-500 font-black uppercase tracking-wider">Cancelado</span>
                            </div>
                          </div>
                        ) : (
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
                        )}
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
              {loading || jornadaLoading ? (
                <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
              ) : !jornadaActiva ? (
                <Card className="bg-card border border-border border-l-[6px] border-l-primary/60">
                  <CardContent className="py-12 text-center">
                    <Wallet className="w-10 h-10 text-primary/70 mx-auto mb-3" />
                    <p className="text-base font-black uppercase tracking-wide mb-1">Iniciá la jornada</p>
                    <p className="text-xs text-muted-foreground font-medium max-w-sm mx-auto">
                      Para ver los pedidos de cocina, abrí la jornada desde la tab{' '}
                      <button
                        onClick={() => setActiveTab('caja')}
                        className="underline font-black uppercase text-primary hover:text-primary/80"
                      >
                        Caja
                      </button>.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <KitchenView
                  orders={orders.filter(o => o.jornadaId === jornadaActiva.id)}
                  onSendToKitchen={handleSendToKitchen}
                  onMarkReady={handleMarkReady}
                  isPending={isPending}
                />
              )}
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

            {/* ── TAB: CAJA ── */}
            <TabsContent value="caja" className="space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <Wallet className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-black uppercase tracking-wide">Caja</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Apertura y cierre de jornada. Los pedidos creados mientras hay una jornada abierta quedan asociados automáticamente.
              </p>
              <CajaCard
                currentUserId={pb.authStore.model?.id}
                jornada={jornadaActiva}
                jornadaLoading={jornadaLoading}
                onJornadaChange={() => { refetchJornada(); loadData(); }}
              />
            </TabsContent>

            {/* ── TAB: MENÚ (vista cliente embebida) ── */}
            <TabsContent value="menu" className="space-y-3">
              <MenuPreviewContent />
            </TabsContent>

            {/* ── TAB: REPORTES ── */}
            <TabsContent value="reportes" className="space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <BarChart3 className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-black uppercase tracking-wide">Reportes</h2>
              </div>
              <ReportsContent />
            </TabsContent>

            {/* ── TAB: CONFIGURACIÓN ── */}
            <TabsContent value="config" className="space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <Settings className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-black uppercase tracking-wide">Configuración</h2>
              </div>
              <SettingsContent />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
