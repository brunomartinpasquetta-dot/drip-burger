import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ── Layout fullscreen reutilizable ────────────────────────────────
const FullScreen = ({ children }) => (
  <div className="fixed inset-0 z-40 overflow-y-auto bg-[#0a0a0a]">
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12">
      {children}
    </div>
  </div>
);

const Brand = () => (
  <div className="flex flex-col items-center mb-8">
    <h1
      className="text-4xl md:text-5xl font-black uppercase tracking-tighter"
      style={{ fontFamily: 'Bangers, system-ui, sans-serif', color: '#F5A800', letterSpacing: '0.02em' }}
    >
      DRIP BURGER
    </h1>
    <span className="text-[10px] font-mono tracking-widest text-muted-foreground mt-1">
      STREETWEAR BURGERS
    </span>
  </div>
);

// ── Hook: cargar order para mostrar metadata ─────────────────────
const useOrder = (orderId) => {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    if (!orderId) return;
    let active = true;
    (async () => {
      try {
        const rec = await pb.collection('orders').getOne(orderId, { requestKey: null });
        if (active) setOrder(rec);
      } catch (e) {
        // noop
      }
    })();
    return () => { active = false; };
  }, [orderId]);
  return order;
};

// ══════════════════════════════════════════════════════════════════
//  ✓ ÉXITO  /pedido-confirmado/:orderId
// ══════════════════════════════════════════════════════════════════
export const PaymentSuccessPage = () => {
  const { orderId } = useParams();
  const order = useOrder(orderId);

  return (
    <>
      <Helmet><title>¡Pedido confirmado! - DRIP BURGER</title></Helmet>
      <FullScreen>
        <Brand />

        <div
          className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-[#22c55e]/15 text-[#22c55e] mb-6 animate-in zoom-in-50 duration-500"
        >
          <CheckCircle2 className="w-16 h-16" strokeWidth={2.5} />
        </div>

        <h2
          className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-center mb-3"
          style={{ fontFamily: 'Bangers, system-ui, sans-serif', color: '#F5A800', letterSpacing: '0.01em' }}
        >
          ¡Pedido confirmado!
        </h2>
        <p className="text-lg md:text-xl font-bold text-foreground text-center mb-2">
          Tu pago fue procesado con éxito
        </p>
        <p className="text-sm text-muted-foreground font-medium text-center mb-6">
          Gracias por elegir Drip Burger
        </p>

        {order && (
          <div className="bg-card/60 border border-border rounded-lg px-5 py-3 mb-8 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Número de pedido</p>
            <p className="text-xl font-black tracking-tight tabular-nums">
              #{order.orderNumber || order.id}
            </p>
            {order.deliveryTimeSlot && (
              <p className="text-xs font-bold uppercase tracking-wider text-primary mt-1">
                Entrega · {order.deliveryTimeSlot}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <Button
            asChild
            className="btn-primary h-12 flex-1 font-black uppercase tracking-wide"
          >
            <Link to={orderId ? `/confirmacion/${orderId}` : '/mis-pedidos'}>
              Ver mi pedido
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 flex-1 border-border bg-transparent hover:bg-muted text-foreground font-black uppercase tracking-wide"
          >
            <Link to="/menu">Volver al menú</Link>
          </Button>
        </div>
      </FullScreen>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════
//  ✗ FALLIDO  /pedido-fallido/:orderId
// ══════════════════════════════════════════════════════════════════
export const PaymentFailedPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const order = useOrder(orderId);
  const [retrying, setRetrying] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleRetry = async () => {
    if (!orderId || retrying) return;
    setRetrying(true);
    try {
      const res = await apiServerClient.fetch('/payments/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const { initPoint } = await res.json();
      if (!initPoint) throw new Error('Mercado Pago no devolvió initPoint');
      window.location.href = initPoint;
    } catch (err) {
      console.error('[PaymentFailed] retry failed:', err);
      toast.error('No se pudo reintentar el pago: ' + (err.message || err));
      setRetrying(false);
    }
  };

  const handleSwitchToCash = async () => {
    if (!orderId || switching) return;
    setSwitching(true);
    try {
      await pb.collection('orders').update(orderId, {
        forma_pago: 'Efectivo',
        paymentMethod: 'Efectivo',
        paymentStatus: 'Pendiente',
      }, { requestKey: null });
      toast.success('Pago cambiado a efectivo');
      navigate(`/confirmacion/${orderId}`);
    } catch (err) {
      console.error('[PaymentFailed] switch to cash failed:', err);
      toast.error('No se pudo cambiar a efectivo: ' + (err.message || err));
      setSwitching(false);
    }
  };

  return (
    <>
      <Helmet><title>El pago no se pudo procesar - DRIP BURGER</title></Helmet>
      <FullScreen>
        <Brand />

        <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-red-500/15 text-red-400 mb-6 animate-in zoom-in-50 duration-500">
          <XCircle className="w-16 h-16" strokeWidth={2.5} />
        </div>

        <h2
          className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-center mb-3"
          style={{ fontFamily: 'Bangers, system-ui, sans-serif', color: '#F5A800', letterSpacing: '0.01em' }}
        >
          El pago no se pudo procesar
        </h2>
        <p className="text-lg md:text-xl font-bold text-foreground text-center mb-2">
          No te preocupes, tu pedido fue guardado
        </p>
        <p className="text-sm text-muted-foreground font-medium text-center mb-8 max-w-md">
          Podés intentar pagar de nuevo o elegir pago en efectivo al recibir.
        </p>

        {order && (
          <div className="bg-card/60 border border-border rounded-lg px-5 py-3 mb-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pedido</p>
            <p className="text-lg font-black tracking-tight tabular-nums">#{order.orderNumber || order.id}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-md">
          <Button
            onClick={handleRetry}
            disabled={retrying || switching}
            className="btn-primary h-12 font-black uppercase tracking-wide"
          >
            {retrying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {retrying ? 'Reintentando...' : 'Reintentar pago'}
          </Button>
          <Button
            onClick={handleSwitchToCash}
            disabled={retrying || switching}
            variant="outline"
            className="h-12 border-2 border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-400 font-black uppercase tracking-wide"
          >
            {switching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {switching ? 'Cambiando...' : 'Pagar en efectivo'}
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-10 text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-xs"
          >
            <Link to="/menu">Volver al menú</Link>
          </Button>
        </div>
      </FullScreen>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════
//  ⏳ PENDIENTE  /pedido-pendiente/:orderId
// ══════════════════════════════════════════════════════════════════
export const PaymentPendingPage = () => {
  const { orderId } = useParams();
  const order = useOrder(orderId);

  return (
    <>
      <Helmet><title>Pago en proceso - DRIP BURGER</title></Helmet>
      <FullScreen>
        <Brand />

        <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-primary/15 text-primary mb-6 animate-in zoom-in-50 duration-500">
          <Clock className="w-16 h-16" strokeWidth={2.5} />
        </div>

        <h2
          className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-center mb-3"
          style={{ fontFamily: 'Bangers, system-ui, sans-serif', color: '#F5A800', letterSpacing: '0.01em' }}
        >
          Pago en proceso
        </h2>
        <p className="text-lg md:text-xl font-bold text-foreground text-center mb-2">
          Tu pago está siendo verificado
        </p>
        <p className="text-sm text-muted-foreground font-medium text-center mb-8 max-w-md">
          Te vamos a notificar cuando se confirme. Si pagaste por transferencia
          puede demorar unos minutos.
        </p>

        {order && (
          <div className="bg-card/60 border border-border rounded-lg px-5 py-3 mb-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pedido</p>
            <p className="text-lg font-black tracking-tight tabular-nums">#{order.orderNumber || order.id}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <Button
            asChild
            className="btn-primary h-12 flex-1 font-black uppercase tracking-wide"
          >
            <Link to={orderId ? `/confirmacion/${orderId}` : '/mis-pedidos'}>
              Ver mi pedido
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 flex-1 border-border bg-transparent hover:bg-muted text-foreground font-black uppercase tracking-wide"
          >
            <Link to="/menu">Volver al menú</Link>
          </Button>
        </div>
      </FullScreen>
    </>
  );
};
