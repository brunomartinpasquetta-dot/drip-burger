
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useCart } from '@/contexts/CartContext.jsx';
import { useShippingPrice } from '@/hooks/useShippingPrice.js';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const CheckoutPage = () => {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { shippingPrice, loading: shippingLoading, formatShipping } = useShippingPrice();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre_apellido: '',
    telefono: '',
    direccion: '',
    horario_reparto: '',
    forma_pago: 'Efectivo'
  });

  const [loading, setLoading] = useState(false);

  const timeSlots = ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];

  const subtotal = getCartTotal();
  const total = subtotal + (shippingLoading ? 0 : shippingPrice);
  const shippingInfo = formatShipping(shippingPrice);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();

    if (!formData.horario_reparto) {
      toast.error('Seleccioná un horario de entrega');
      return;
    }

    if (shippingLoading) {
      toast.error('Calculando precio de envío, esperá unos segundos.');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        orderNumber: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
        user_id: null,
        customerId: null,
        nombre_apellido: formData.nombre_apellido,
        telefono: formData.telefono,
        direccion: formData.direccion,
        customerName: formData.nombre_apellido,
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
        totalAmount: total,
        horario_reparto: formData.horario_reparto,
        deliveryTimeSlot: formData.horario_reparto, 
        forma_pago: formData.forma_pago,
        paymentMethod: formData.forma_pago,         
        orderStatus: 'Pendiente'
      };

      const order = await pb.collection('orders').create(orderData, { $autoCancel: false });
      clearCart();
      toast.success(`¡Pedido confirmado! Tu número de orden es ${order.orderNumber}`);
      navigate('/menu');
    } catch (error) {
      toast.error('Error al crear el pedido. Por favor intentá de nuevo.');
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-black uppercase">Tu carrito está vacío</h2>
            <Button onClick={() => navigate('/menu')} className="btn-primary">Ir al Menú</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Checkout - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-10">
            Check<span className="text-primary">out</span>
          </h1>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <form onSubmit={handleCheckoutSubmit} className="space-y-8">
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="pb-4 border-b border-border bg-muted/5">
                    <CardTitle className="text-2xl font-black uppercase tracking-wide">Tus Datos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-6">
                    <div className="space-y-2">
                      <Label htmlFor="nombre_apellido" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre y Apellido</Label>
                      <Input
                        id="nombre_apellido"
                        value={formData.nombre_apellido}
                        onChange={(e) => setFormData({ ...formData, nombre_apellido: e.target.value })}
                        required
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="telefono" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono</Label>
                        <Input
                          id="telefono"
                          type="tel"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          required
                          className="bg-background border-border text-foreground h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="direccion" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección de entrega</Label>
                        <Input
                          id="direccion"
                          value={formData.direccion}
                          onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                          required
                          className="bg-background border-border text-foreground h-12"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="pb-4 border-b border-border bg-muted/5">
                    <CardTitle className="text-2xl font-black uppercase tracking-wide">Horario</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Label htmlFor="horario_reparto" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Elegí un horario de entrega</Label>
                    <Select
                      value={formData.horario_reparto}
                      onValueChange={(value) => setFormData({ ...formData, horario_reparto: value })}
                    >
                      <SelectTrigger id="horario_reparto" className="bg-background border-border text-foreground h-12 font-bold">
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
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="pb-4 border-b border-border bg-muted/5">
                    <CardTitle className="text-2xl font-black uppercase tracking-wide">Pago</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <RadioGroup
                      value={formData.forma_pago}
                      onValueChange={(value) => setFormData({ ...formData, forma_pago: value })}
                      className="space-y-4"
                    >
                      <div className="flex items-center space-x-3 bg-background p-4 rounded-xl border border-border transition-colors hover:border-primary/50">
                        <RadioGroupItem value="Efectivo" id="efectivo" className="border-primary text-primary" />
                        <Label htmlFor="efectivo" className="cursor-pointer font-bold uppercase tracking-wide text-base flex-1">Efectivo al recibir</Label>
                      </div>
                      <div className="flex items-center space-x-3 bg-background p-4 rounded-xl border border-border transition-colors hover:border-primary/50">
                        <RadioGroupItem value="Transferencia" id="transferencia" className="border-primary text-primary" />
                        <Label htmlFor="transferencia" className="cursor-pointer font-bold uppercase tracking-wide text-base flex-1">Transferencia</Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                <Button type="submit" size="lg" className="w-full btn-primary h-16 text-xl" disabled={loading || shippingLoading}>
                  {loading ? 'Procesando...' : 'Confirmar Pedido'}
                </Button>
              </form>
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-28 bg-card border-border shadow-lg">
                <CardHeader className="pb-4 border-b border-border bg-muted/10">
                  <CardTitle className="text-xl font-black uppercase tracking-wide">Resumen</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <div key={`${item.productId}-${item.pattyCount}`} className="flex justify-between items-start">
                        <div>
                          <p className="font-bold uppercase text-sm">{item.productName}</p>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            {item.pattyCount}p x {item.quantity}
                          </p>
                        </div>
                        <span className="font-black">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground uppercase tracking-wider">Subtotal</span>
                      <span className="font-bold">{formatPrice(subtotal)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm font-medium items-center">
                      <span className="text-muted-foreground uppercase tracking-wider">Costo de Envío</span>
                      {shippingLoading ? (
                        <Skeleton className="h-5 w-20" />
                      ) : (
                        <div className={`font-bold text-right ${shippingInfo.isFree ? 'text-green-500' : ''}`}>
                          {shippingInfo.text}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border pt-6">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                      {shippingLoading ? (
                        <Skeleton className="h-8 w-28" />
                      ) : (
                        <span className="text-3xl font-black text-primary">{formatPrice(total)}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckoutPage;
