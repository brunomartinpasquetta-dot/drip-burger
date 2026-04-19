import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { XCircle, Clock, ArrowRight } from 'lucide-react';

export const PaymentFailedPage = () => {
  const { orderId } = useParams();
  return (
    <>
      <Helmet><title>Pago fallido - DRIP BURGER</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 max-w-xl text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/15 text-red-400 mb-6">
            <XCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-3">
            El pago <span className="text-red-400">falló</span>
          </h1>
          <p className="text-muted-foreground font-medium mb-8">
            No se pudo procesar tu pago en Mercado Pago. Podés intentar de nuevo o
            elegir pagar en efectivo al recibir el pedido.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="btn-primary font-black uppercase tracking-wide">
              <Link to="/carrito">Reintentar pago</Link>
            </Button>
            {orderId && (
              <Button asChild size="lg" variant="outline" className="border-border font-black uppercase tracking-wide">
                <Link to={`/confirmacion/${orderId}`}>Ver mi pedido</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export const PaymentPendingPage = () => {
  const { orderId } = useParams();
  return (
    <>
      <Helmet><title>Pago pendiente - DRIP BURGER</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 max-w-xl text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/15 text-amber-400 mb-6">
            <Clock className="w-10 h-10" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-3">
            Pago <span className="text-amber-400">pendiente</span>
          </h1>
          <p className="text-muted-foreground font-medium mb-8">
            Tu pago está siendo revisado por Mercado Pago. Te avisamos apenas se
            confirme. Podés consultar el estado en cualquier momento desde el
            detalle del pedido.
          </p>
          {orderId && (
            <Button asChild size="lg" className="btn-primary font-black uppercase tracking-wide">
              <Link to={`/confirmacion/${orderId}`}>
                Ver estado del pedido
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
};
