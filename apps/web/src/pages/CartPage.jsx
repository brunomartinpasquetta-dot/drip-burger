
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Trash2, ShoppingBag, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
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
    horario_reparto: '',
    forma_pago: 'Efectivo'
  });

  const {
    shippingPrice,
    zona,
    precios,
    loading: shippingLoading,
    formatShipping,
  } = useShippingPrice(formData.direccion);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectingToMp, setRedirectingToMp] = useState(false);

  // Disponibilidad de tandas: [{slot, usedMedallions, available, full}]
  const [slotAvailability, setSlotAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);

  const timeSlots = ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];

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

  // Auto-deseleccionar si el slot pasó a inválido (full o sin medallones suficientes)
  useEffect(() => {
    if (!formData.horario_reparto || availabilityLoading) return;
    const info = getSlotInfo(formData.horario_reparto);
    if (!info) return;
    const invalid = info.full || (cartMedallions > 0 && info.available < cartMedallions);
    if (invalid) {
      toast.error('Ese horario ya no tiene lugar suficiente, elegí otro');
      setFormData(prev => ({ ...prev, horario_reparto: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotAvailability, cartMedallions]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = true;
    if (!formData.apellido.trim()) newErrors.apellido = true;
    if (!formData.telefono.trim()) newErrors.telefono = true;
    if (!formData.direccion.trim()) newErrors.direccion = true;
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
      toast.error('Completá todos los campos requeridos marcados en rojo');
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

      const orderData = {
        nombre_apellido: nombreCompleto,
        telefono: formData.telefono,
        direccion: formData.direccion,
        customerName: nombreCompleto,
        customerPhone: formData.telefono,
        customerAddress: formData.direccion,
        items: cartItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          hasMedallions: item.hasMedallions !== false,
          pattyCount: item.pattyCount,
          quantity: item.quantity,
          price: item.price
        })),
        precio_envio_snapshot: shippingPrice,
        totalAmount: totalAmount,
        horario_reparto: formData.horario_reparto,
        deliveryTimeSlot: formData.horario_reparto,
        forma_pago: formData.forma_pago,
        paymentMethod: formData.forma_pago,
        paymentStatus: 'Pendiente',
        orderStatus: 'Pendiente'
      };

      if (currentUser?.id) {
        orderData.user_id = currentUser.id;
      }

      const order = await pb.collection('orders').create(orderData, { requestKey: null });

      if (formData.forma_pago === 'Transferencia') {
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

      clearCart();
      navigate(`/confirmacion/${order.id}`, { state: { order } });
    } catch (error) {
      console.error('Order creation failed:', error?.response?.data || error);
      toast.error('Error al crear el pedido. Por favor intentá de nuevo.');
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
                  <Label htmlFor="telefono" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono</Label>
                  <Input
                    id="telefono"
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className={cn(
                      "bg-background border-border text-foreground focus-visible:ring-1",
                      errors.telefono && "border-destructive bg-destructive/10 focus-visible:ring-destructive"
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direccion" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección de Entrega</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Ej: San Martín 1550"
                    className={cn(
                      "bg-background border-border text-foreground focus-visible:ring-1",
                      errors.direccion && "border-destructive bg-destructive/10 focus-visible:ring-destructive"
                    )}
                  />
                  {formData.direccion.trim() && !shippingLoading && zona && (
                    <div
                      className={cn(
                        "flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded border",
                        zona === 'centro'
                          ? "text-green-400 border-green-500/40 bg-green-500/10"
                          : "text-orange-400 border-orange-500/40 bg-orange-500/10"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-[8px]">●</span>
                        {zona === 'centro' ? 'Zona centro' : 'Zona alejada'}
                      </span>
                      <span className="tabular-nums">
                        {shippingPrice === 0 ? 'Envío gratis' : `Envío ${formatPrice(shippingPrice)}`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Horario de Reparto</Label>
                  <Select
                    value={formData.horario_reparto}
                    onValueChange={(value) => setFormData({ ...formData, horario_reparto: value })}
                  >
                    <SelectTrigger
                      className={cn(
                        "bg-background border-border text-foreground font-bold",
                        errors.horario_reparto && "border-destructive bg-destructive/10 focus:ring-destructive"
                      )}
                    >
                      <SelectValue placeholder="Seleccioná un horario" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {timeSlots.map((slot) => {
                        const info = getSlotInfo(slot);
                        const full = info?.full === true;
                        const available = info?.available ?? null;
                        // Insuficiente: hay lugar pero no alcanza para el pedido actual
                        const insufficient =
                          !full &&
                          available !== null &&
                          cartMedallions > 0 &&
                          available < cartMedallions;
                        const almostFull =
                          !full &&
                          !insufficient &&
                          available !== null &&
                          available > 0 &&
                          available <= 3;
                        const disabled = full || insufficient;
                        return (
                          <SelectItem
                            key={slot}
                            value={slot}
                            disabled={disabled}
                            className={cn(
                              "font-bold focus:bg-primary/20 focus:text-primary",
                              full && "line-through text-red-500 opacity-50 cursor-not-allowed",
                              insufficient && "text-red-500 opacity-60 cursor-not-allowed",
                              almostFull && "text-yellow-500"
                            )}
                          >
                            {slot}
                            {full && (
                              <span className="ml-2 text-[10px] font-black uppercase">· Sin lugar</span>
                            )}
                            {insufficient && (
                              <span className="ml-2 text-[10px] font-black uppercase">
                                · Solo quedan {available} medallones
                              </span>
                            )}
                            {almostFull && (
                              <span className="ml-2 text-[10px] font-black uppercase">
                                · Últimos {available} medallones
                              </span>
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {availabilityLoading && (
                    <p className="text-[10px] text-muted-foreground font-medium">Verificando disponibilidad...</p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Forma de Pago</Label>
                  <Select
                    value={formData.forma_pago}
                    onValueChange={(value) => setFormData({ ...formData, forma_pago: value })}
                  >
                    <SelectTrigger
                      className={cn(
                        "bg-background border-border text-foreground font-bold uppercase",
                        errors.forma_pago && "border-destructive bg-destructive/10 focus:ring-destructive"
                      )}
                    >
                      <SelectValue placeholder="Seleccioná método de pago" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="Efectivo" className="font-bold uppercase focus:bg-primary/20 focus:text-primary">Efectivo al recibir</SelectItem>
                      <SelectItem value="Transferencia" className="font-bold uppercase focus:bg-primary/20 focus:text-primary">Pagar online</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.forma_pago === 'Transferencia' && (
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                      Tarjeta, transferencia o Mercado Pago
                    </p>
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
                        Envío
                        {zona && (
                          <span className="ml-1.5 text-[10px] font-black tracking-widest opacity-70">
                            · {zona === 'centro' ? 'CENTRO' : 'ALEJADA'}
                          </span>
                        )}
                      </span>
                      {shippingLoading ? (
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
                        : (formData.forma_pago === 'Transferencia' ? 'Pagar' : 'Hacer Pedido')}
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
