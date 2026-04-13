
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const OrderHistoryPage = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentUser) return;

      try {
        const records = await pb.collection('orders').getFullList({
          filter: `user_id = "${currentUser.id}"`,
          sort: '-created',
          requestKey: null
        });
        setOrders(records);
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser]);

  return (
    <>
      <Helmet>
        <title>Mis Pedidos - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-4xl">
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
              Mis <span className="text-primary">Pedidos</span>
            </h1>
            <p className="text-muted-foreground mt-2 font-medium">Historial de tus compras en DRIP BURGER.</p>
          </div>

          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-48 w-full rounded-2xl" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="py-24 text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h2 className="text-2xl font-black uppercase mb-2">Aún no hay pedidos</h2>
                <p className="text-muted-foreground font-medium mb-8">Pedite algo, no seas careta.</p>
                <Button asChild className="btn-primary">
                  <Link to="/menu">Ver Menú</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const shipping = order.precio_envio_snapshot || 0;
                const itemsTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const orderDate = new Date(order.created);

                return (
                  <Card key={order.id} className="bg-card border-border shadow-sm overflow-hidden group">
                    <div className="bg-muted/10 p-4 border-b border-border flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-black uppercase text-xl">#{order.orderNumber}</h3>
                          <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            order.orderStatus === 'Finalizado' ? 'bg-green-500/20 text-green-500' :
                            order.orderStatus === 'En camino' ? 'bg-primary/20 text-primary' :
                            'bg-yellow-500/20 text-yellow-500'
                          }`}>
                            {order.orderStatus || 'Pendiente'}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground font-medium">
                          <Calendar className="w-4 h-4 mr-1.5" />
                          {format(orderDate, "d 'de' MMMM, yyyy", { locale: es })}
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="font-black text-2xl text-primary">{formatPrice(order.totalAmount)}</p>
                      </div>
                    </div>
                    
                    <CardContent className="p-6">
                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Detalle</p>
                          <div className="space-y-3">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-start text-sm">
                                <div>
                                  <span className="font-bold uppercase">{item.productName}</span>
                                  <span className="text-muted-foreground ml-2">({item.pattyCount}p) x {item.quantity}</span>
                                </div>
                                <span className="font-medium text-muted-foreground">{formatPrice(item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-background rounded-xl p-4 border border-border">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Resumen</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium text-muted-foreground">Subtotal</span>
                              <span className="font-bold">{formatPrice(itemsTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium text-muted-foreground">Envío</span>
                              {shipping === 0 ? (
                                <span className="text-green-500 font-bold">Gratis 🛵</span>
                              ) : (
                                <span className="font-bold">{formatPrice(shipping)}</span>
                              )}
                            </div>
                            <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
                              <span className="font-bold uppercase text-xs">Total Abonado</span>
                              <span className="font-black text-primary text-lg">{formatPrice(order.totalAmount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default OrderHistoryPage;
