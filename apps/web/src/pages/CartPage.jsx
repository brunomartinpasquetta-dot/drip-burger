
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCart } from '@/contexts/CartContext.jsx';
import { useShippingPrice } from '@/hooks/useShippingPrice.js';
import { useStoreHours } from '@/hooks/useStoreHours';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import { cn } from '@/lib/utils.js';
import Header from '@/components/Header.jsx';
import AddressAutocomplete from '@/components/AddressAutocomplete.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// NOTA: el Radix Select de shadcn (que vivía en @/components/ui/select) se sacó
// del flow del cliente porque su Portal + overlay rompía la viewport en mobile
// cuando aparecía el teclado virtual → pantalla negra sin contenido. Usamos
// <select> HTML nativo: en iOS dispara la ruleta del sistema, en Android el
// dropdown del SO, y elimina el bug de raíz. El admin sigue usando Radix.
import { Minus, Plus, Trash2, ShoppingBag, Loader2, Check, ShoppingBasket, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { normalizePhone, isValidPhone, formatPreview, esTelefonoValido } from '@/lib/phoneAr.js';
import { FORMA_PAGO, MERCADOPAGO_UI_ENABLED } from '@/lib/orderConstants.js';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

// Bloque de datos de transferencia bancaria mostrado al cliente cuando elige
// "Transferencia bancaria". Lee titular/alias/cbu del singleton settings.
// Cada campo es copiable con un click.
const BankTransferDetails = () => {
  const [data, setData] = useState({ titular: '', alias: '', cbu: '' });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await pb.collection('settings').getList(1, 1, { requestKey: null });
        if (!mounted) return;
        if (res.items.length > 0) {
          const r = res.items[0];
          setData({
            titular: r.transferencia_titular || '',
            alias: r.transferencia_alias || '',
            cbu: r.transferencia_cbu || '',
          });
        }
      } catch (e) { /* noop */ }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const copy = (value, label) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success(`${label} copiado`);
  };

  if (loading) return <Skeleton className="h-32 w-full mt-2" />;
  if (!data.cbu && !data.alias && !data.titular) {
    return (
      <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mt-1">
        ⚠ Datos de transferencia no configurados todavía. Avisá al local.
      </p>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-lg border-2 border-primary/40 bg-primary/5 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
        Datos para transferir
      </p>
      {data.titular && (
        <button
          type="button"
          onClick={() => copy(data.titular, 'Titular')}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-background border border-border hover:border-primary/50 transition-colors"
        >
          <div className="text-left min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Titular</div>
            <div className="text-sm font-bold truncate">{data.titular}</div>
          </div>
          <span className="text-[10px] text-muted-foreground">📋</span>
        </button>
      )}
      {data.alias && (
        <button
          type="button"
          onClick={() => copy(data.alias, 'Alias')}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-background border border-border hover:border-primary/50 transition-colors"
        >
          <div className="text-left min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Alias</div>
            <div className="text-sm font-bold font-mono truncate">{data.alias}</div>
          </div>
          <span className="text-[10px] text-muted-foreground">📋</span>
        </button>
      )}
      {data.cbu && (
        <button
          type="button"
          onClick={() => copy(data.cbu, 'CBU')}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-background border border-border hover:border-primary/50 transition-colors"
        >
          <div className="text-left min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">CBU</div>
            <div className="text-sm font-bold font-mono tabular-nums truncate">{data.cbu}</div>
          </div>
          <span className="text-[10px] text-muted-foreground">📋</span>
        </button>
      )}
      <p className="text-[10px] text-muted-foreground font-medium leading-relaxed pt-1 border-t border-primary/20">
        Hacé la transferencia y al confirmar el pedido el local va a validar el pago manualmente.
      </p>
    </div>
  );
};

const CartPage = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const { cartItems, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
  const { isOpen: storeIsOpen, horaApertura, horaCierre, loading: hoursLoading } = useStoreHours();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    direccion: '',
    observacion: '',
    takeAway: false,
    horario_reparto: '',
    // forma_pago se manda directo a PB. Valores válidos del SelectField
    // tras la migración 1777700000: 'Efectivo' | 'Transferencia' | 'Mercado Pago'.
    forma_pago: 'Efectivo'
  });

  // Coords del browser cuando el cliente usa "Mi ubicación". Si están seteadas,
  // el zonificador las usa DIRECTO (más preciso que reverse-geocode +
  // re-geocode). Se limpian apenas el cliente edita el texto a mano.
  const [geoCoords, setGeoCoords] = useState(null);

  const {
    shippingPrice: shippingPriceRaw,
    zona,
    zonaNombre,
    zonaColor,
    lat: zoneLat,
    lng: zoneLng,
    outOfZone: shippingOutOfZone,
    precios,
    loading: shippingLoading,
    notFound: shippingNotFound,
    formatShipping,
  } = useShippingPrice(formData.direccion, geoCoords);

  // Take Away: no se cobra envío; el zona/precios se ignoran.
  const shippingPrice = formData.takeAway ? 0 : shippingPriceRaw;

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectingToMp, setRedirectingToMp] = useState(false);

  // Disponibilidad de tandas: [{slot, usedMedallions, available, full}]
  const [slotAvailability, setSlotAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);

  const timeSlots = ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];

  // Cierre anticipado: un slot deja de estar disponible para nuevos pedidos
  // 10 min antes de su horario (ej: 20:30 cierra a las 20:20). Reduce el riesgo
  // de pedidos last-second que la cocina no llega a preparar.
  const SLOT_CUTOFF_MINUTES = 10;

  // Tick para forzar re-render cada 30s y refrescar los chequeos de "cerrado".
  // Sin esto, si el cliente abre la pantalla 5 min antes del slot, no vería
  // el cambio cuando entra el corte hasta que toque algo.
  const [slotTick, setSlotTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSlotTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Devuelve true si ya pasamos el horario - 10 min. Comparación contra hora
  // local del navegador del cliente (todo el flow opera en AR, navegador en
  // AR — no necesitamos timezone-aware aquí).
  const isSlotClosed = (slot) => {
    if (!slot || !/^\d{1,2}:\d{2}$/.test(slot)) return false;
    const [h, m] = slot.split(':').map((n) => parseInt(n, 10));
    const slotDate = new Date();
    slotDate.setHours(h, m, 0, 0);
    const cutoffMs = slotDate.getTime() - SLOT_CUTOFF_MINUTES * 60 * 1000;
    return Date.now() >= cutoffMs;
    // eslint-disable-next-line react-hooks/exhaustive-deps — slotTick fuerza recompute
  };

  // Suma medallones del carrito actual. Productos sin medallones no cuentan.
  const cartMedallions = cartItems.reduce((sum, item) => {
    if (item.hasMedallions === false) return sum;
    const patty = Number(item.pattyCount) || 0;
    const qty = Number(item.quantity) || 0;
    return sum + patty * qty;
  }, 0);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const parts = (currentUser.nombre_apellido || currentUser.name || '').split(' ');
      setFormData(prev => ({
        ...prev,
        nombre: parts[0] || '',
        apellido: parts.slice(1).join(' ') || currentUser.surname || '',
        telefono: currentUser.telefono || currentUser.phone || '',
        direccion: currentUser.direccion || currentUser.address || ''
      }));
    }
  }, [isAuthenticated, currentUser]);

  // Fetch slot availability al mount + poll cada 30s
  useEffect(() => {
    let mounted = true;
    let intervalId = null;

    const loadAvailability = async () => {
      try {
        const res = await apiServerClient.fetch('/slots/availability');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Defensa: si la API no responde JSON (otro server en VITE_API_URL),
        // res.json() tira SyntaxError. Detectamos por content-type. NO bloqueamos
        // el checkout — sin disponibilidad de slots simplemente no mostramos
        // los chips "Sin lugar / Últimos N", el cliente puede igual elegir slot.
        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('application/json')) {
          console.warn('[CartPage] slot availability: API no responde JSON (¿API caída o VITE_API_URL mal apuntada?)');
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        setSlotAvailability(data.slots || []);
      } catch (err) {
        console.error('[CartPage] slot availability failed:', err);
      } finally {
        if (mounted) setAvailabilityLoading(false);
      }
    };

    loadAvailability();
    intervalId = setInterval(loadAvailability, 30000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Lookup helper: info de disponibilidad para un slot dado
  const getSlotInfo = (slot) => slotAvailability.find((s) => s.slot === slot);

  // Auto-deseleccionar si el slot pasó a inválido (cerrado, full, o sin
  // medallones suficientes). Corre cuando cambia availability, cartMedallions
  // o el slotTick (cada 30s, para capturar el cutoff de 6 min sin clicks).
  useEffect(() => {
    if (!formData.horario_reparto || availabilityLoading) return;
    if (isSlotClosed(formData.horario_reparto)) {
      toast.error('Ese horario ya cerró (cierra 6 minutos antes), elegí otro');
      setFormData(prev => ({ ...prev, horario_reparto: '' }));
      return;
    }
    const info = getSlotInfo(formData.horario_reparto);
    if (!info) return;
    const invalid = info.full || (cartMedallions > 0 && info.available < cartMedallions);
    if (invalid) {
      toast.error('Ese horario ya no tiene lugar suficiente, elegí otro');
      setFormData(prev => ({ ...prev, horario_reparto: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotAvailability, cartMedallions, slotTick]);

  // Pre-cómputo del teléfono: limpieza + validación anti-trolleo + preview
  const phoneCheck = esTelefonoValido(formData.telefono);
  const phoneNormalized = normalizePhone(formData.telefono);
  const phoneValidAr = isValidPhone(phoneNormalized);
  const phonePreview = phoneValidAr ? formatPreview(phoneNormalized) : '';

  const validateForm = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = true;
    if (!formData.apellido.trim()) newErrors.apellido = true;
    // Teléfono: validación anti-trolleo bloqueante (sin números falsos
    // tipo 0000000000, 1111111111, 1234567890, etc).
    if (!phoneCheck.valid) newErrors.telefono = true;
    // Take Away: no se pide dirección.
    if (!formData.takeAway && !formData.direccion.trim()) newErrors.direccion = true;
    // Dirección fuera del área de cobertura (geocoding no la encontró en Coronda).
    if (!formData.takeAway && shippingNotFound) newErrors.direccion = true;
    if (!formData.horario_reparto) newErrors.horario_reparto = true;
    if (!formData.forma_pago) newErrors.forma_pago = true;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePaymentClick = async () => {
    if (hoursLoading) {
      toast.error('Verificando horario de atención, esperá unos segundos.');
      return;
    }

    if (!storeIsOpen) {
      toast.error(`Estamos cerrados. Horario de atención: ${horaApertura || '—'} a ${horaCierre || '—'}`);
      return;
    }

    if (!validateForm()) {
      // Mensaje específico cuando lo único bloqueante es el teléfono
      if (!phoneCheck.valid && formData.telefono.trim()) {
        toast.error(`Teléfono inválido: ${phoneCheck.reason}. Necesitamos un número real para coordinarte el pedido.`);
      } else {
        toast.error('Completá todos los campos requeridos marcados en rojo');
      }
      return;
    }

    // Pre-flight: slot no debe estar cerrado por cutoff de 10 min
    if (isSlotClosed(formData.horario_reparto)) {
      toast.error('Ese horario ya cerró (cierra 10 minutos antes), elegí otro');
      setFormData(prev => ({ ...prev, horario_reparto: '' }));
      return;
    }
    // Pre-flight: validar que el slot tenga medallones suficientes
    const slotInfo = getSlotInfo(formData.horario_reparto);
    if (slotInfo) {
      if (slotInfo.full || (cartMedallions > 0 && slotInfo.available < cartMedallions)) {
        toast.error('Ese horario ya no tiene lugar suficiente, elegí otro');
        setFormData(prev => ({ ...prev, horario_reparto: '' }));
        return;
      }
    }

    if (shippingLoading) {
      toast.error('Calculando precio de envío, esperá unos segundos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nombreCompleto = `${formData.nombre} ${formData.apellido}`.trim();
      const subtotal = getCartTotal();
      const totalAmount = subtotal + shippingPrice;

      // Sentinel cuando es take away: el schema de orders tiene direccion
      // y customerAddress como required, así que en vez de string vacía
      // guardamos un placeholder que el resto del sistema interpreta junto
      // con `takeAway: true` (cards admin, ticket, comanda).
      const TAKE_AWAY_SENTINEL = 'TAKE AWAY — Retira en local';
      const direccionFinal = formData.takeAway
        ? TAKE_AWAY_SENTINEL
        : formData.direccion;

      // Payload base con campos que SIEMPRE existen en el schema. Los
      // opcionales (takeAway, clienteId) se agregan abajo SÓLO si aplican,
      // así si una migración no se aplicó todavía en PB, el pedido no se
      // rechaza por validation_value_invalid.
      const orderData = {
        nombre_apellido: nombreCompleto,
        // Persistimos siempre el teléfono normalizado (formato 549XXXXXXXXXX)
        // para que la API de WhatsApp y los reportes nunca dependan de cómo
        // lo escribió el cliente en el form.
        telefono: phoneNormalized,
        direccion: direccionFinal,
        customerName: nombreCompleto,
        customerPhone: phoneNormalized,
        customerAddress: direccionFinal,
        items: cartItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          hasMedallions: item.hasMedallions !== false,
          // Snapshot — la comanda y el ticket leen este flag, no el producto vivo
          incluyeFritas:
            typeof item.incluyeFritas === 'boolean'
              ? item.incluyeFritas
              : item.hasMedallions !== false,
          pattyCount: item.pattyCount,
          quantity: item.quantity,
          price: item.price
        })),
        precio_envio_snapshot: shippingPrice,
        // Coords geocoded — usamos para el link de Google Maps en el ticket
        // del delivery. Take-away no lleva coords (no hay reparto).
        lat: formData.takeAway ? null : (Number.isFinite(zoneLat) ? zoneLat : null),
        lng: formData.takeAway ? null : (Number.isFinite(zoneLng) ? zoneLng : null),
        totalAmount: totalAmount,
        horario_reparto: formData.horario_reparto,
        deliveryTimeSlot: formData.horario_reparto,
        // forma_pago/paymentMethod van directo: el SelectField acepta los 3
        // valores tras la migración 1777700000.
        forma_pago: formData.forma_pago,
        paymentMethod: formData.forma_pago,
        paymentStatus: 'Pendiente',
        orderStatus: 'Pendiente',
        // Observación del cliente — max 50 chars. PB también enforce el max
        // pero hacemos el slice acá por defensa (input tiene maxLength igual).
        observacion: (formData.observacion || '').trim().slice(0, 50),
      };

      // takeAway: sólo agregamos si es true. Evita rechazo de PB si la
      // migración 1777300000 no se aplicó (campo no existe).
      if (formData.takeAway) {
        orderData.takeAway = true;
      }

      if (currentUser?.id) {
        // user_id mapea al user staff legacy; clienteId mapea a la collection
        // nueva `clientes`. Seteamos sólo el que corresponda según la
        // collection del auth actual para no romper rules ni schema.
        if (currentUser.collectionName === 'clientes') {
          orderData.clienteId = currentUser.id;
        } else {
          orderData.user_id = currentUser.id;
        }
      }

      const order = await pb.collection('orders').create(orderData, { requestKey: null });

      if (formData.forma_pago === FORMA_PAGO.MERCADOPAGO) {
        // Crear preferencia MP y redirigir al checkout de Mercado Pago
        setRedirectingToMp(true);
        try {
          const res = await apiServerClient.fetch('/payments/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${res.status}`);
          }
          const { initPoint } = await res.json();
          if (!initPoint) throw new Error('Mercado Pago no devolvió initPoint');
          clearCart();
          window.location.href = initPoint;
          return;
        } catch (err) {
          console.error('[CartPage] MP preference failed:', err);
          setRedirectingToMp(false);
          toast.error('No se pudo iniciar el pago con Mercado Pago. Probá con Efectivo o intentá de nuevo.');
          setIsSubmitting(false);
          return;
        }
      }

      // Si es transferencia bancaria, disparamos el WA con datos del banco +
      // pedido de comprobante. Esperamos la respuesta (corta) para saber si el
      // mensaje se mandó y mostrar el banner correcto en la confirmación.
      // Tolerante: cualquier fallo se traduce en "no se mandó" y caemos al
      // fallback en pantalla con los datos copiables.
      let bankWa = { messageSent: false, phoneNormalized: phoneNormalized };
      if (formData.forma_pago === FORMA_PAGO.TRANSFERENCIA) {
        try {
          const res = await apiServerClient.fetch('/orders/send-bank-transfer-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              customerPhone: phoneNormalized,
              customerName: nombreCompleto,
              totalAmount,
              orderNumber: order.orderNumber,
            }),
          });
          const ctype = res.headers.get('content-type') || '';
          if (res.ok && ctype.includes('application/json')) {
            const data = await res.json();
            bankWa = {
              messageSent: !!data.messageSent,
              phoneNormalized: data.phoneNormalized || phoneNormalized,
              reason: data.reason,
            };
          }
        } catch (err) {
          console.warn('[CartPage] send-bank-transfer-info failed:', err);
        }
      }

      clearCart();
      navigate(`/confirmacion/${order.id}`, { state: { order, bankWa } });
    } catch (error) {
      // Surface el campo que falla la validación de PB para que el admin
      // pueda diagnosticar (ej: "clienteId no existe en schema" → falta migrar).
      console.error('Order creation failed:', error?.response?.data || error);
      const detail = error?.response?.data;
      let userMsg = 'Error al crear el pedido. Por favor intentá de nuevo.';
      if (detail?.data && typeof detail.data === 'object') {
        const fields = Object.entries(detail.data)
          .map(([k, v]) => `${k}: ${v?.message || v?.code || JSON.stringify(v)}`)
          .join(' · ');
        if (fields) userMsg = `Pedido rechazado por: ${fields}`;
      } else if (detail?.message) {
        userMsg = `Pedido rechazado: ${detail.message}`;
      } else if (error?.message) {
        userMsg = `Error: ${error.message}`;
      }
      toast.error(userMsg);
      setIsSubmitting(false);
    }
  };

  if (redirectingToMp) {
    return (
      <>
        <Helmet><title>Redirigiendo a Mercado Pago...</title></Helmet>
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a] px-6">
          <h1
            className="text-5xl md:text-6xl font-black uppercase tracking-tighter mb-2"
            style={{ fontFamily: 'Bangers, system-ui, sans-serif', color: '#F5A800', letterSpacing: '0.02em' }}
          >
            DRIP BURGER
          </h1>
          <div className="w-16 h-1 bg-primary/40 rounded-full mb-10" />
          <Loader2 className="w-14 h-14 text-primary animate-spin mb-6" />
          <p className="text-xl md:text-2xl font-black uppercase tracking-wide text-foreground text-center max-w-md">
            Te estamos redirigiendo a Mercado Pago...
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-3">
            No cierres esta ventana
          </p>
        </div>
      </>
    );
  }

  if (cartItems.length === 0) {
    return (
      <>
        <Helmet>
          <title>Carrito - DRIP BURGER</title>
        </Helmet>
        <div className="min-h-screen bg-background">
          <Header />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="max-w-2xl mx-auto text-center py-16 bg-card border border-border rounded-3xl shadow-sm">
              <ShoppingBag className="w-24 h-24 mx-auto mb-6 text-muted-foreground/30" />
              <h1 className="text-4xl font-black uppercase tracking-tight mb-4">Carrito Vacío</h1>
              <p className="text-muted-foreground mb-8 font-medium text-lg">
                Falta DRIP BURGER acá. Agregá algo del menú.
              </p>
              <Button asChild size="lg" className="btn-primary px-10 h-14">
                <Link to="/menu">Ver Menú</Link>
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const subtotal = getCartTotal();
  const total = subtotal + (shippingLoading ? 0 : shippingPrice);
  const shippingInfo = formatShipping(shippingPrice);

  return (
    <>
      <Helmet>
        <title>Checkout - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background pb-20">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-10 text-center lg:text-left">
            Finalizar <span style={{ color: 'var(--accent-orange)' }}>Pedido</span>
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

            {/* COLUMN 1: PRODUCTS */}
            <div className="lg:col-span-4 space-y-6">
              <h2 className="text-xl font-black uppercase border-b border-border pb-2">1. Tu Pedido</h2>
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const imageUrl = item.productImage
                    ? `${pb.baseUrl}/api/files/products/${item.productId}/${item.productImage}`
                    : null;

                  return (
                    <Card key={`${item.productId}-${item.pattyCount}`} className="bg-card border-border overflow-hidden">
                      <CardContent className="p-3 flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#0a0a0a] rounded-md shrink-0 overflow-hidden flex items-center justify-center">
                          {imageUrl ? (
                            <img src={imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-2">
                            <h3 className="font-black uppercase text-sm truncate">
                              {item.quantity > 1 && <span className="text-primary tabular-nums">{item.quantity}× </span>}
                              {item.productName}
                              {item.hasMedallions !== false && (
                                <span className="text-muted-foreground font-bold"> · {item.pattyCount} {item.pattyCount === 1 ? 'medallón' : 'medallones'}</span>
                              )}
                            </h3>
                            <span className="text-sm font-black text-primary tabular-nums shrink-0">
                              {formatPrice(item.price)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1 bg-background rounded border border-border p-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-primary hover:text-primary-foreground"
                                onClick={() => updateQuantity(item.productId, item.pattyCount, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-4 text-center font-bold text-xs">{item.quantity}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-primary hover:text-primary-foreground"
                                onClick={() => updateQuantity(item.productId, item.pattyCount, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.productId, item.pattyCount)}
                              className="text-destructive h-7 px-2 hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: CUSTOMER FORM */}
            <div className="lg:col-span-4 space-y-6">
              <h2 className="text-xl font-black uppercase border-b border-border pb-2" style={{ color: 'var(--accent-orange)' }}>
                2. Tus Datos
              </h2>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className={cn(
                        "bg-background border-border text-foreground focus-visible:ring-1",
                        errors.nombre && "border-destructive bg-destructive/10 focus-visible:ring-destructive"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Apellido</Label>
                    <Input
                      id="apellido"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      className={cn(
                        "bg-background border-border text-foreground focus-visible:ring-1",
                        errors.apellido && "border-destructive bg-destructive/10 focus-visible:ring-destructive"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    WhatsApp
                  </Label>
                  <Input
                    id="telefono"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="3425551234"
                    value={formData.telefono}
                    onChange={(e) => {
                      // Limpieza en vivo: sólo dígitos. Si pegan "342 555-1234"
                      // o "342abc1234" queda únicamente el número.
                      const onlyDigits = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, telefono: onlyDigits });
                    }}
                    maxLength={14}
                    className={cn(
                      "bg-background border-border text-foreground focus-visible:ring-1 tabular-nums",
                      errors.telefono && "border-destructive bg-destructive/10 focus-visible:ring-destructive",
                      formData.telefono && !phoneCheck.valid && "border-red-500 bg-red-500/5"
                    )}
                  />
                  {/* Helper dinámico:
                      - vacío: tip neutral
                      - inválido: mensaje rojo con motivo específico
                      - válido AR: preview verde con +54 9 ... */}
                  {!formData.telefono ? (
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Sólo números. Con característica, sin 0 ni 15.
                    </p>
                  ) : !phoneCheck.valid ? (
                    <p className="text-[11px] font-bold text-red-500">
                      ⚠ {phoneCheck.reason}
                    </p>
                  ) : (
                    <div className="flex items-start gap-1.5 text-[10px] font-medium text-green-500/90">
                      <Check className="w-3 h-3 shrink-0 mt-px" />
                      <span>
                        {phoneValidAr
                          ? <>Te avisamos a <span className="font-bold tabular-nums">{phonePreview}</span></>
                          : 'Número aceptado.'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Toggle Take Away — si está ON oculta dirección y no cobra envío */}
                <div className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border-2 transition-all",
                  formData.takeAway
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-background/40"
                )}>
                  <div className="flex items-center gap-2 min-w-0">
                    <ShoppingBasket className={cn(
                      "w-4 h-4 shrink-0",
                      formData.takeAway ? "text-primary" : "text-muted-foreground"
                    )} />
                    <div className="min-w-0">
                      <Label htmlFor="takeAway" className={cn(
                        "text-xs font-black uppercase tracking-wide cursor-pointer block",
                        formData.takeAway ? "text-primary" : "text-foreground"
                      )}>
                        Take Away
                      </Label>
                      <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                        Retiro en el local — sin envío
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="takeAway"
                    checked={formData.takeAway}
                    onCheckedChange={(checked) => setFormData({ ...formData, takeAway: checked })}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Dirección de envío — sólo si NO es take away */}
                {!formData.takeAway && (
                  <div className="space-y-2">
                    <Label htmlFor="direccion" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección de Entrega</Label>
                    <AddressAutocomplete
                      value={formData.direccion}
                      onChange={(v) => {
                        // Si el cliente EDITA el texto manualmente, las geoCoords
                        // del "Mi ubicación" ya no aplican (el texto y las coords
                        // se desincronizan). Limpiamos para volver al geocoder.
                        if (geoCoords) setGeoCoords(null);
                        setFormData({ ...formData, direccion: v });
                      }}
                      onCoords={(c) => setGeoCoords(c)}
                      placeholder="Ej: San Martín 1550"
                      error={!!errors.direccion}
                    />
                    {/* Estado del geocoding: cargando, fuera de cobertura, zona/distancia/fijo resuelto */}
                    {formData.direccion.trim() && shippingLoading && (
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2.5 py-1.5">
                        Verificando dirección...
                      </div>
                    )}
                    {formData.direccion.trim() && !shippingLoading && shippingNotFound && (
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded border text-red-400 border-red-500/40 bg-red-500/10">
                        <span className="text-[8px]">●</span>
                        <span>Dirección no encontrada. Revisá calle y número o usá 📍 Mi ubicación.</span>
                      </div>
                    )}
                    {formData.direccion.trim() && !shippingLoading && shippingOutOfZone && (
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded border text-red-400 border-red-500/40 bg-red-500/10">
                        <span className="text-[8px]">●</span>
                        <span>Fuera del área de envío. Probá una dirección más cercana al local.</span>
                      </div>
                    )}
                    {formData.direccion.trim() && !shippingLoading && zona && (
                      <div
                        className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded border"
                        style={{
                          color: zonaColor || '#10b981',
                          borderColor: (zonaColor || '#10b981') + '66',
                          backgroundColor: (zonaColor || '#10b981') + '1a',
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-[8px]">●</span>
                          {zonaNombre || (zona === 'centro' ? 'Zona centro' : 'Zona alejada')}
                        </span>
                        <span className="tabular-nums">
                          {shippingPrice === 0 ? 'Envío gratis' : `Envío ${formatPrice(shippingPrice)}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Observación del cliente — max 50 chars. Se imprime en
                    comanda de cocina y en ticket de delivery; el admin
                    también la ve como badge en la card del pedido. */}
                <div className="space-y-1">
                  <Label htmlFor="observacion" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Observación <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="observacion"
                    type="text"
                    maxLength={50}
                    value={formData.observacion}
                    onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                    placeholder="Ej: Sin cebolla, casa puerta roja, dejar en portería..."
                    className="bg-background border-border text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground text-right tabular-nums">
                    {(formData.observacion || '').length}/50
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Horario de Reparto</Label>
                  <div className="relative">
                    <select
                      value={formData.horario_reparto}
                      onChange={(e) => setFormData({ ...formData, horario_reparto: e.target.value })}
                      className={cn(
                        "appearance-none w-full h-10 pl-3 pr-9 rounded-md border bg-background text-foreground font-bold text-sm cursor-pointer",
                        "border-border focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary",
                        // Cuando no hay valor, mostramos el placeholder en gris
                        !formData.horario_reparto && "text-muted-foreground",
                        errors.horario_reparto && "border-destructive bg-destructive/10 focus:ring-destructive"
                      )}
                    >
                      <option value="" disabled>Seleccioná un horario</option>
                      {(() => {
                        // slotTick fuerza el recompute cuando pasa el cutoff
                        // de los 10 min sin que el cliente toque nada.
                        void slotTick;
                        // Filtramos los slots NO disponibles antes de renderizar.
                        // Antes mostrábamos los cerrados/llenos disabled con sufijo
                        // "· CERRADO" — los clientes leían eso como "el local no
                        // toma pedidos a esta hora" y se iban. Mejor mostrarles
                        // solo los slots que SÍ pueden elegir.
                        const visibleSlots = timeSlots
                          .map((slot) => {
                            const closed = isSlotClosed(slot);
                            const info = getSlotInfo(slot);
                            const full = info?.full === true;
                            const available = info?.available ?? null;
                            const insufficient =
                              !closed &&
                              !full &&
                              available !== null &&
                              cartMedallions > 0 &&
                              available < cartMedallions;
                            const almostFull =
                              !closed &&
                              !full &&
                              !insufficient &&
                              available !== null &&
                              available > 0 &&
                              available <= 3;
                            return { slot, closed, full, insufficient, almostFull, available };
                          })
                          .filter((s) => !s.closed && !s.full && !s.insufficient);
                        if (visibleSlots.length === 0) {
                          return (
                            <option value="" disabled>Sin horarios disponibles ahora</option>
                          );
                        }
                        return visibleSlots.map(({ slot, almostFull, available }) => {
                          const suffix = almostFull ? ` · ÚLTIMOS ${available} MEDALLONES` : '';
                          return (
                            <option key={slot} value={slot}>
                              {slot}{suffix}
                            </option>
                          );
                        });
                      })()}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {availabilityLoading && (
                    <p className="text-[10px] text-muted-foreground font-medium">Verificando disponibilidad...</p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Forma de Pago</Label>
                  <div className="relative">
                    <select
                      value={formData.forma_pago}
                      onChange={(e) => setFormData({ ...formData, forma_pago: e.target.value })}
                      className={cn(
                        "appearance-none w-full h-10 pl-3 pr-9 rounded-md border bg-background text-foreground font-bold uppercase text-sm cursor-pointer",
                        "border-border focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary",
                        errors.forma_pago && "border-destructive bg-destructive/10 focus:ring-destructive"
                      )}
                    >
                      <option value={FORMA_PAGO.EFECTIVO}>Efectivo al recibir</option>
                      {MERCADOPAGO_UI_ENABLED && (
                        <option value={FORMA_PAGO.MERCADOPAGO}>Pagar online (Mercado Pago)</option>
                      )}
                      <option value={FORMA_PAGO.TRANSFERENCIA}>Transferencia bancaria</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {formData.forma_pago === FORMA_PAGO.MERCADOPAGO && (
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                      Tarjeta, transferencia o Mercado Pago
                    </p>
                  )}
                  {formData.forma_pago === FORMA_PAGO.TRANSFERENCIA && (
                    <BankTransferDetails />
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 3: SUMMARY */}
            <div className="lg:col-span-4 space-y-6">
              <h2 className="text-xl font-black uppercase border-b border-border pb-2">3. Resumen</h2>

              <Card className="bg-card border-border shadow-lg sticky top-24">
                <CardContent className="p-6">
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground uppercase tracking-wider">Subtotal</span>
                      <span className="font-bold">{formatPrice(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-sm font-medium items-center">
                      <span className="text-muted-foreground uppercase tracking-wider">
                        {formData.takeAway ? 'Take Away' : 'Envío'}
                        {!formData.takeAway && zona && (
                          <span className="ml-1.5 text-[10px] font-black tracking-widest opacity-70">
                            · {zona === 'centro' ? 'CENTRO' : 'ALEJADA'}
                          </span>
                        )}
                      </span>
                      {formData.takeAway ? (
                        <div className="font-bold text-right text-primary uppercase text-xs tracking-wider">
                          Retiro en local
                        </div>
                      ) : shippingLoading ? (
                        <Skeleton className="h-5 w-20" />
                      ) : (
                        <div className={`font-bold text-right ${shippingInfo.isFree ? 'text-green-500' : ''}`}>
                          {shippingInfo.text}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border pt-6 mb-6">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                      {shippingLoading ? (
                        <Skeleton className="h-10 w-32" />
                      ) : (
                        <span className="text-4xl font-black" style={{ color: 'var(--accent-orange)' }}>
                          {formatPrice(total)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Banner de local cerrado — bloquea el submit */}
                  {!hoursLoading && !storeIsOpen && (
                    <div className="mb-4 p-4 rounded-lg border-2 border-red-500/50 bg-red-500/10">
                      <p className="text-sm font-black uppercase tracking-wide text-red-400 mb-1">
                        ⛔ Local cerrado
                      </p>
                      <p className="text-xs text-red-300 font-medium">
                        No se pueden hacer pedidos fuera del horario de atención.
                      </p>
                      {horaApertura && horaCierre && (
                        <p className="text-xs text-muted-foreground font-bold mt-1 tabular-nums">
                          Horario: {horaApertura} — {horaCierre}
                        </p>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handlePaymentClick}
                    className="w-full h-14 text-lg mb-4 font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--accent-orange)', color: 'var(--text-dark)' }}
                    disabled={isSubmitting || shippingLoading || hoursLoading || !storeIsOpen}
                  >
                    {isSubmitting
                      ? 'Procesando...'
                      : !storeIsOpen && !hoursLoading
                        ? 'Cerrado — No se puede pedir'
                        : (formData.forma_pago === FORMA_PAGO.MERCADOPAGO
                            ? 'Pagar'
                            : formData.forma_pago === FORMA_PAGO.TRANSFERENCIA
                              ? 'Confirmar pedido'
                              : 'Hacer Pedido')}
                  </Button>

                  <Button asChild variant="outline" className="w-full h-12 font-bold uppercase tracking-widest bg-transparent border-border hover:bg-muted text-foreground">
                    <Link to="/menu">Seguir Comprando</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default CartPage;
