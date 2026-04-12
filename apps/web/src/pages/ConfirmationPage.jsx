
import React, { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import RegistrationModal from '@/components/RegistrationModal.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, MapPin, Receipt, ArrowRight } from 'lucide-react';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const ConfirmationPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState('idle'); // 'idle', 'dismissed', 'success'

  useEffect(() => {
    if (!order && id) {
      const fetchOrder = async () => {
        try {
          const record = await pb.collection('orders').getOne(id, { $autoCancel: false });
          setOrder(record);
        } catch (err) {
          setError('No se pudo cargar el pedido.');
        } finally {
          setLoading(false);
        }
      };
      fetchOrder();
    }
  }, [id, order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-24 max-w-2xl">
          <Skeleton className="h-64 w-full rounded-2xl mb-8" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-32 max-w-lg text-center">
          <h1 className="text-3xl font-black uppercase mb-4 text-destructive">Error</h1>
          <p className="text-muted-foreground mb-8 font-medium">{error || 'Pedido no encontrado.'}</p>
          <Button asChild className="btn-primary">
            <Link to="/">Volver al Inicio</Link>
          </Button>
        </div>
      </div>
    );
  }

  const shipping = order.precio_envio_snapshot || 0;
  const itemsTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <>
      <Helmet>
        <title>Confirmación - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#22c55e]/20 text-[#22c55e] mb-6">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4">
              ¡Pedido <span className="text-primary">Confirmado</span>!
            </h1>
            <p className="text-xl text-muted-foreground font-medium">
              Tu número de orden es <span className="font-black text-foreground">#{order.orderNumber}</span>
            </p>
          </div>

          <div className="grid gap-6 mb-10">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-xl font-black uppercase tracking-wide mb-6 border-b border-border pb-4">
                  Detalles de Entrega
                </h2>
                
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Dirección</p>
                      <p className="font-bold text-base">{order.customerAddress}</p>
                      <p className="text-muted-foreground text-sm mt-1">{order.customerName}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Horario</p>
                      <p className="font-bold text-base">{order.deliveryTimeSlot}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                  <Receipt className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-black uppercase tracking-wide">Resumen del Pedido</h2>
                </div>

                <div className="space-y-4 mb-6">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-sm">
                      <div>
                        <p className="font-bold uppercase">{item.productName}</p>
                        <p className="text-muted-foreground">({item.pattyCount}p) x {item.quantity}</p>
                      </div>
                      <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Subtotal</span>
                    <span className="font-bold">{formatPrice(itemsTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Envío</span>
                    {shipping === 0 ? (
                      <span className="text-[#22c55e] font-bold uppercase tracking-wide">Gratis 🛵</span>
                    ) : (
                      <span className="font-bold">{formatPrice(shipping)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Forma de Pago</span>
                    <span className="font-bold uppercase text-primary">{order.paymentMethod}</span>
                  </div>
                </div>

                <div className="border-t border-border mt-6 pt-6">
                  <div className="flex justify-between items-end">
                    <span className="text-base font-bold uppercase tracking-wider">Total</span>
                    <span className="text-3xl font-black text-primary">{formatPrice(order.totalAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Registration Invitation Section */}
          {!isAuthenticated && registrationStatus === 'idle' && (
            <div className="bg-[#1a1a1a] border-2 border-[#F5A800] rounded-2xl p-6 md:p-8 mb-10 text-center shadow-lg transition-all duration-300">
              <h2 className="text-2xl md:text-3xl font-black uppercase text-white mb-3">¿Pedís seguido?</h2>
              <p className="text-gray-300 mb-8 font-medium text-base">Guardá tus datos y la próxima vez solo elegís y confirmás.</p>
              <div className="flex flex-col items-center justify-center gap-4">
                <Button 
                  onClick={() => setIsModalOpen(true)} 
                  className="bg-[#F5A800] hover:bg-[#F5A800]/90 text-black font-black uppercase w-full sm:w-auto px-10 h-14 text-lg"
                >
                  Crear mi cuenta
                </Button>
                <button 
                  onClick={() => setRegistrationStatus('dismissed')} 
                  className="text-gray-500 hover:text-gray-300 font-bold uppercase text-sm tracking-wider transition-colors"
                >
                  Ahora no
                </button>
              </div>
            </div>
          )}

          {/* Registration Success Message */}
          {!isAuthenticated && registrationStatus === 'success' && (
            <div className="bg-[#1a1a1a] border border-[#22c55e]/30 rounded-2xl p-6 mb-10 text-center transition-all duration-500 animate-in fade-in zoom-in-95">
              <p className="text-[#22c55e] font-bold uppercase tracking-wide text-lg flex items-center justify-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                Cuenta creada! La próxima vez tus datos se cargan solos.
              </p>
            </div>
          )}

          <div className="text-center">
            <Button asChild size="lg" className="btn-secondary px-8 font-bold uppercase tracking-wide">
              <Link to="/">
                Volver al Inicio
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <RegistrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setRegistrationStatus('success')}
        checkoutData={{
          nombre_apellido: order?.customerName,
          telefono: order?.customerPhone,
          direccion: order?.customerAddress
        }}
      />
    </>
  );
};

export default ConfirmationPage;
