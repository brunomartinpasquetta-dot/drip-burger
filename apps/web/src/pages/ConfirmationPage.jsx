
import React, { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import RegistrationModal from '@/components/RegistrationModal.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, MapPin, Receipt, ArrowRight, Loader2, MessageCircle } from 'lucide-react';
import { FORMA_PAGO } from '@/lib/orderConstants';
import { toast } from 'sonner';

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
  // Estado del envío de WhatsApp con los datos bancarios. Sólo viene cargado
  // cuando llegamos desde el checkout con forma_pago=Transferencia.
  const bankWa = location.state?.bankWa || null;
  const [bankData, setBankData] = useState({ titular: '', alias: '', cbu: '' });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState('idle'); // 'idle', 'dismissed', 'success'

  useEffect(() => {
    if (!order && id) {
      const fetchOrder = async () => {
        try {
          const record = await pb.collection('orders').getOne(id, { requestKey: null });
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

  // Si el pago figura pendiente y la forma es Mercado Pago, polleamos
  // /payments/status por hasta 20s para capturar el webhook con delay.
  // (Transferencia bancaria NO se pollea: la valida el admin manualmente.)
  const [mpPolling, setMpPolling] = useState(false);
  useEffect(() => {
    if (!order) return;
    if (order.paymentMethod !== FORMA_PAGO.MERCADOPAGO) return;
    if (order.paymentStatus === 'Pagado') return;

    setMpPolling(true);
    let active = true;
    let attempts = 0;
    const poll = async () => {
      while (active && attempts < 10) {
        attempts += 1;
        try {
          const res = await apiServerClient.fetch(`/payments/status/${id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.paymentStatus === 'Pagado') {
              if (active) setOrder((prev) => ({ ...prev, paymentStatus: 'Pagado' }));
              break;
            }
          }
        } catch (e) {
          // noop — seguimos intentando
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (active) setMpPolling(false);
    };
    poll();
    return () => { active = false; };
  }, [order, id]);

  // Si el pago es transferencia bancaria, cargamos los datos del banco para
  // mostrarlos como fallback cuando el WA no se haya podido mandar.
  useEffect(() => {
    if (!order) return;
    if (order.paymentMethod !== FORMA_PAGO.TRANSFERENCIA) return;
    if (bankWa?.messageSent) return; // si llegó el WA no hace falta el fallback
    let mounted = true;
    (async () => {
      try {
        const res = await pb.collection('settings').getList(1, 1, { requestKey: null });
        if (!mounted) return;
        if (res.items.length > 0) {
          const r = res.items[0];
          setBankData({
            titular: r.transferencia_titular || '',
            alias: r.transferencia_alias || '',
            cbu: r.transferencia_cbu || '',
          });
        }
      } catch (e) { /* noop */ }
    })();
    return () => { mounted = false; };
  }, [order, bankWa]);

  const copyBank = (value, label) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success(`${label} copiado`);
  };

  // Formato amistoso del teléfono: +54 9 342 555 1234
  const formatPhonePreview = (n) => {
    const s = String(n || '');
    if (s.length < 12) return s;
    // 549XXXXXXXXXX → +54 9 XXX XXX XXXX
    return `+${s.slice(0,2)} ${s.slice(2,3)} ${s.slice(3,6)} ${s.slice(6,9)} ${s.slice(9)}`;
  };

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
  const items = order.items || [];
  const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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

            {/* Badge de estado de pago */}
            {(() => {
              const isMp = order.paymentMethod === FORMA_PAGO.MERCADOPAGO;
              const isTransfer = order.paymentMethod === FORMA_PAGO.TRANSFERENCIA;
              const isPaid = order.paymentStatus === 'Pagado';
              if (isMp && isPaid) {
                return (
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-green-500/40 bg-green-500/10 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-black uppercase tracking-wide text-sm">Pagado ✓</span>
                  </div>
                );
              }
              if (isMp && !isPaid) {
                return (
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-amber-500/40 bg-amber-500/10 text-amber-400">
                    {mpPolling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                    <span className="font-black uppercase tracking-wide text-sm">
                      {mpPolling ? 'Verificando pago...' : '⏳ Esperando confirmación de pago'}
                    </span>
                  </div>
                );
              }
              if (isTransfer && isPaid) {
                return (
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-green-500/40 bg-green-500/10 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-black uppercase tracking-wide text-sm">Transferencia confirmada ✓</span>
                  </div>
                );
              }
              if (isTransfer && !isPaid) {
                return (
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-amber-500/40 bg-amber-500/10 text-amber-400">
                    <Clock className="w-5 h-5" />
                    <span className="font-black uppercase tracking-wide text-sm">⏳ Esperando comprobante de transferencia</span>
                  </div>
                );
              }
              return (
                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary/50 bg-primary/10 text-primary">
                  <Clock className="w-5 h-5" />
                  <span className="font-black uppercase tracking-wide text-sm">Pago en efectivo al delivery</span>
                </div>
              );
            })()}

            {/* Banner WhatsApp — sólo para transferencia bancaria */}
            {order.paymentMethod === FORMA_PAGO.TRANSFERENCIA && order.paymentStatus !== 'Pagado' && (
              bankWa?.messageSent ? (
                <div className="mt-6 mx-auto max-w-2xl rounded-2xl border-2 border-green-500/40 bg-green-500/5 p-5 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-wide text-green-400 mb-1">
                        Te mandamos los datos por WhatsApp
                      </p>
                      <p className="text-sm text-foreground/90 font-medium">
                        Revisá tu chat al{' '}
                        <span className="font-black tabular-nums">
                          {formatPhonePreview(bankWa.phoneNormalized || order.customerPhone)}
                        </span>
                        . Hacé la transferencia y respondé con la foto del comprobante para confirmar tu pedido.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 mx-auto max-w-2xl rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-5 text-left">
                  <p className="text-sm font-black uppercase tracking-wide text-amber-400 mb-3">
                    {bankWa?.reason ? `No pudimos mandarte WhatsApp (${bankWa.reason}).` : 'Datos para transferir'}
                  </p>
                  <p className="text-sm text-foreground/90 font-medium mb-4">
                    Hacé la transferencia y mandanos el comprobante por WhatsApp para confirmar el pedido.
                  </p>
                  <div className="space-y-2">
                    {bankData.titular && (
                      <button
                        type="button"
                        onClick={() => copyBank(bankData.titular, 'Titular')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded bg-background border border-border hover:border-primary/50 transition-colors"
                      >
                        <div className="text-left min-w-0">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Titular</div>
                          <div className="text-sm font-bold truncate">{bankData.titular}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">📋</span>
                      </button>
                    )}
                    {bankData.alias && (
                      <button
                        type="button"
                        onClick={() => copyBank(bankData.alias, 'Alias')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded bg-background border border-border hover:border-primary/50 transition-colors"
                      >
                        <div className="text-left min-w-0">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Alias</div>
                          <div className="text-sm font-bold font-mono truncate">{bankData.alias}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">📋</span>
                      </button>
                    )}
                    {bankData.cbu && (
                      <button
                        type="button"
                        onClick={() => copyBank(bankData.cbu, 'CBU')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded bg-background border border-border hover:border-primary/50 transition-colors"
                      >
                        <div className="text-left min-w-0">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">CBU</div>
                          <div className="text-sm font-bold font-mono tabular-nums truncate">{bankData.cbu}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">📋</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
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
                      {(() => {
                        const isTakeAway = order.takeAway || /^TAKE AWAY/i.test(order.customerAddress || '');
                        return (
                          <>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              {isTakeAway ? 'Take Away' : 'Dirección'}
                            </p>
                            <p className="font-bold text-base">
                              {isTakeAway ? 'Retira en el local' : order.customerAddress}
                            </p>
                            <p className="text-muted-foreground text-sm mt-1">{order.customerName}</p>
                          </>
                        );
                      })()}
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
                  {items.map((item, idx) => {
                    const lleva = typeof item.incluyeFritas === 'boolean'
                      ? item.incluyeFritas
                      : item.hasMedallions !== false;
                    return (
                      <div key={idx} className="flex justify-between items-start text-sm">
                        <div>
                          <p className="font-bold uppercase">
                            {item.quantity > 1 && <span className="text-primary tabular-nums">{item.quantity}× </span>}
                            {item.productName}
                            {item.hasMedallions !== false && (
                              <span className="text-muted-foreground font-medium"> · {item.pattyCount} {item.pattyCount === 1 ? 'medallón' : 'medallones'}</span>
                            )}
                          </p>
                          {lleva && (
                            <p className="text-xs mt-0.5" style={{ color: '#999' }}>+ papas fritas</p>
                          )}
                        </div>
                        <span className="font-bold tabular-nums">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    );
                  })}
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
