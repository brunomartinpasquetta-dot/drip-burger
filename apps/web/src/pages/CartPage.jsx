
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCart } from '@/contexts/CartContext.jsx';
import { useShippingPrice } from '@/hooks/useShippingPrice.js';
import pb from '@/lib/pocketbaseClient';
import { cn } from '@/lib/utils.js';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const CartPage = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const { cartItems, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
  const { shippingPrice, loading: shippingLoading, formatShipping } = useShippingPrice();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    direccion: '',
    horario_reparto: '',
    forma_pago: 'Efectivo'
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeSlots = ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];

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
    if (!validateForm()) {
      toast.error('Completá todos los campos requeridos marcados en rojo');
      return;
    }

    if (shippingLoading) {
      toast.error('Calculando precio de envío, esperá unos segundos.');
      return;
    }

    if (formData.forma_pago === 'Transferencia') {
      toast('Integración con Mercado Pago próximamente', {
        icon: '🚧',
        style: { background: 'var(--accent-orange)', color: 'var(--text-dark)', border: 'none' }
      });
      return;
    }

    // Process Efectivo
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

      const order = await pb.collection('orders').create(orderData, { $autoCancel: false });
      clearCart();
      navigate(`/confirmacion/${order.id}`, { state: { order } });
    } catch (error) {
      console.error('Order creation failed:', error?.response?.data || error);
      toast.error('Error al crear el pedido. Por favor intentá de nuevo.');
      setIsSubmitting(false);
    }
  };

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
                          <h3 className="font-black uppercase text-sm truncate">{item.productName}</h3>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            {item.pattyCount}p - {formatPrice(item.price)}
                          </p>
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
                    className={cn(
                      "bg-background border-border text-foreground focus-visible:ring-1",
                      errors.direccion && "border-destructive bg-destructive/10 focus-visible:ring-destructive"
                    )}
                  />
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
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot} className="font-bold focus:bg-primary/20 focus:text-primary">
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="Transferencia" disabled className="font-bold uppercase opacity-50 cursor-not-allowed">Transferencia (próximamente)</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <span className="text-muted-foreground uppercase tracking-wider">Envío</span>
                      {shippingLoading ? (
                        <Skeleton className="h-5 w-20" />
                      ) : (
                        <div className={`font-bold text-right ${shippingInfo.isFree ? 'text-green-500' : ''}`}>
                          {shippingInfo.text}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border pt-6 mb-8">
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

                  <Button
                    onClick={handlePaymentClick}
                    className="w-full h-14 text-lg mb-4 font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all duration-200"
                    style={{ backgroundColor: 'var(--accent-orange)', color: 'var(--text-dark)' }}
                    disabled={isSubmitting || shippingLoading}
                  >
                    {isSubmitting ? 'Procesando...' : (formData.forma_pago === 'Transferencia' ? 'Pagar' : 'Hacer Pedido')}
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
