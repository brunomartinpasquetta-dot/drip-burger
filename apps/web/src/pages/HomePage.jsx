
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import AuthModal from '@/components/AuthModal.jsx';
import ProductCard from '@/components/ProductCard.jsx';
import ConfettiRain from '@/components/ConfettiRain.jsx';
import HamburgerSun from '@/components/HamburgerSun.jsx';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { Instagram, MessageCircle, MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState('register');

  // Productos para el carousel del menú inline (solo desktop)
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await pb.collection('products').getList(1, 50, {
          filter: 'available = true',
          sort: 'orden,created',
          requestKey: null,
        });
        if (mounted) setProducts(res.items || []);
      } catch (err) {
        console.error('[HomePage] failed to load products for carousel:', err);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <Helmet>
        <title>DRIP BURGER - Streetwear Burgers</title>
        <meta name="description" content="DRIP BURGER. No venimos a competir, venimos a marcar la diferencia, mordida a mordida." />
      </Helmet>

      {/* Papelitos celeste/blanco estilo cancha argentina — se dispara al
          montar el Home y dura 5s. Se auto-desmonta al terminar. */}
      <ConfettiRain pieces={180} duration={6000} />

      <div className="min-h-screen bg-background selection:bg-primary selection:text-black flex flex-col">
        <Header />

        {/* Hero Section — mobile: 90vh. desktop: ~52vh para dejar lugar al carousel del menú debajo sin scroll */}
        <section className="relative min-h-[90vh] md:min-h-[52vh] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2000"
              alt="DRIP BURGER"
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_100%)] opacity-80"></div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              {/* Logo mundialista — PNG con fondo transparente (los píxeles
                  negros se pasaron a alpha=0 con PIL). El logo "flota" sobre
                  el hero sin caja. */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="mb-8 md:mb-6 flex justify-center"
              >
                {/* Wrapper del tamaño del logo — el sol se posiciona relativo
                    al PNG, no al flex container (evita drift horizontal). */}
                <div className="relative inline-block">
                  <img
                    src="/LogoDrip-Mundial.png?v=2"
                    alt="DRIP BURGER"
                    className="w-[280px] md:w-[380px] max-w-full h-auto object-contain drop-shadow-[0_4px_30px_rgba(117,170,219,0.35)] relative z-10"
                  />
                  {/* Sol de Mayo — en el hueco entre "DRIP" y "Burger" */}
                  <HamburgerSun
                    size={80}
                    className="absolute z-20"
                    style={{ top: '32%', left: '47%', transform: 'translate(-50%, -50%)' }}
                  />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl md:text-lg text-muted-foreground mb-10 md:mb-6 font-medium max-w-2xl mx-auto leading-relaxed"
              >
                No venimos a competir, venimos a marcar la diferencia, mordida a mordida.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
                  <Button asChild size="lg" className="btn-primary text-lg px-10 h-14">
                    <Link to="/menu">Hacer Pedido</Link>
                  </Button>
                  {!isAuthenticated && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="btn-secondary text-lg px-10 h-14"
                      onClick={() => { setAuthInitialTab('register'); setShowAuthModal(true); }}
                    >
                      Registrarme como Cliente
                    </Button>
                  )}
                </div>
                {/* Botón "Ver Menú" — solo mobile. En desktop el menú aparece inline abajo del hero. */}
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="md:hidden btn-secondary text-lg px-10 h-14 w-full sm:w-auto"
                >
                  <Link to="/menu">Ver Menú</Link>
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Menu Carousel Section — solo desktop (md+). Altura fija 48vh + centrado vertical
            para que hero (52vh) + menú (48vh) = 100vh sin scroll en primera pantalla.
            En mobile se accede via botón "Ver Menú" del hero. */}
        <section className="hidden md:flex md:items-center md:min-h-[48vh] py-8 bg-background border-t border-border relative overflow-hidden">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
            {/* Header del menú: título + subtítulo en una sola línea, centrados.
                "Ver todos" queda absoluto a la derecha para no romper el centrado del par. */}
            <div className="relative flex items-baseline justify-center gap-3 flex-wrap mb-6">
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
                El <span className="text-primary">Menú</span>
              </h2>
              <span className="text-sm md:text-base text-muted-foreground font-medium">
                · Elegí tu burger. Personalizá los medallones. Disfrutá el estilo DRIP.
              </span>
              <Button
                asChild
                variant="outline"
                className="btn-secondary font-bold uppercase tracking-wide shrink-0 hidden lg:inline-flex absolute right-0 top-1/2 -translate-y-1/2"
              >
                <Link to="/menu">
                  Ver todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                    <Skeleton className="aspect-square w-full rounded-none" />
                    <div className="p-6 space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-10 w-full mt-4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <p className="text-lg font-bold uppercase text-muted-foreground">Sin productos disponibles</p>
              </div>
            ) : (
              <Carousel
                opts={{ align: 'start', loop: false }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {products.map((product) => (
                    <CarouselItem
                      key={product.id}
                      id={`product-${product.id}`}
                      className="pl-4 md:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                    >
                      <ProductCard product={product} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            )}
          </div>
        </section>

        {/* Location & Social Media Section — sólo dirección + redes */}
        <section className="py-20 bg-[#1a1a1a] flex-1">
          <div className="container mx-auto px-4 flex flex-col items-center text-center">

            {/* Dirección del local */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10"
            >
              <p className="text-white text-lg md:text-2xl font-bold tracking-wide">
                Juan de Garay 2189, Coronda, Santa Fe
              </p>
            </motion.div>

            {/* Social Icons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="flex flex-row justify-center items-center gap-6 md:gap-8"
            >
              <a
                href="https://instagram.com/drip_burgerr"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-white/5 rounded-full hover:bg-white/10 hover:-translate-y-1 transition-all duration-300"
                aria-label="Instagram"
              >
                <Instagram className="w-7 h-7 md:w-8 md:h-8 text-[#F5A800]" />
              </a>
              <a
                href="https://wa.me/5493425245092"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-white/5 rounded-full hover:bg-white/10 hover:-translate-y-1 transition-all duration-300"
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-7 h-7 md:w-8 md:h-8 text-[#F5A800]" />
              </a>
              <a
                href="https://maps.google.com/?q=Juan+de+Garay+2189,+Coronda,+Santa+Fe"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-white/5 rounded-full hover:bg-white/10 hover:-translate-y-1 transition-all duration-300"
                aria-label="Google Maps"
              >
                <MapPin className="w-7 h-7 md:w-8 md:h-8 text-[#F5A800]" />
              </a>
            </motion.div>
          </div>
        </section>

        {/* Floating WhatsApp Button — con ícono oficial WA, pulse ring
            animado (llama la atención sin ser invasivo) y tooltip
            "Chatéanos" que aparece al hover en desktop. Posición
            intacta (bottom-left). */}
        <div className="fixed bottom-[80px] left-[16px] z-50 group">
          {/* Pulse ring — dos ondas que crecen y desvanecen */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#25D366] opacity-40"
            style={{ animation: 'wa-pulse 2.4s ease-out infinite' }}
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#25D366] opacity-30"
            style={{ animation: 'wa-pulse 2.4s ease-out 1.2s infinite' }}
          />

          {/* Tooltip solo en desktop, aparece al hover */}
          <span
            aria-hidden
            className="hidden md:block absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-[#0f172a] text-white text-xs font-black uppercase tracking-wider px-3 py-2 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          >
            Chateanos
            <span className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-[#0f172a]" />
          </span>

          <a
            href="https://wa.me/5493425245092"
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] shadow-[0_4px_20px_rgba(37,211,102,0.5)] hover:shadow-[0_6px_24px_rgba(37,211,102,0.7)] hover:scale-110 active:scale-95 transition-all duration-200 ring-2 ring-white/20 hover:ring-white/40"
            aria-label="Chateanos por WhatsApp"
            title="Chateanos por WhatsApp"
          >
            {/* Ícono oficial WhatsApp (SVG path del logo real) */}
            <svg viewBox="0 0 32 32" className="w-7 h-7 text-white fill-current" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M16.005 3.2c-7.088 0-12.85 5.762-12.85 12.85 0 2.263.593 4.472 1.72 6.418L3.2 28.8l6.483-1.7a12.826 12.826 0 006.322 1.61h.005c7.088 0 12.85-5.762 12.85-12.85 0-3.433-1.336-6.66-3.764-9.086A12.767 12.767 0 0016.005 3.2zm0 23.494h-.005a10.66 10.66 0 01-5.435-1.488l-.39-.232-4.036 1.058 1.076-3.933-.254-.404a10.647 10.647 0 01-1.63-5.645c0-5.887 4.79-10.677 10.678-10.677 2.851 0 5.532 1.11 7.548 3.127a10.605 10.605 0 013.126 7.55c0 5.888-4.79 10.678-10.678 10.678zm5.856-7.995c-.32-.16-1.897-.936-2.19-1.043-.294-.107-.507-.16-.72.16-.213.32-.827 1.043-1.014 1.256-.187.214-.374.24-.694.08-.32-.16-1.352-.499-2.577-1.59-.952-.848-1.595-1.896-1.782-2.216-.187-.32-.02-.492.14-.652.144-.144.32-.374.48-.561.16-.187.213-.32.32-.534.107-.213.053-.4-.027-.561-.08-.16-.72-1.734-.987-2.376-.26-.624-.523-.54-.72-.55-.187-.008-.4-.01-.614-.01a1.18 1.18 0 00-.854.4c-.294.32-1.121 1.096-1.121 2.67 0 1.576 1.148 3.098 1.308 3.311.16.213 2.259 3.449 5.472 4.836.765.33 1.36.527 1.826.674.767.244 1.466.21 2.019.128.616-.092 1.897-.775 2.164-1.523.267-.748.267-1.39.187-1.523-.08-.133-.293-.213-.614-.373z" />
            </svg>
          </a>

          <style>{`
            @keyframes wa-pulse {
              0%   { transform: scale(1); opacity: 0.5; }
              70%  { transform: scale(1.7); opacity: 0; }
              100% { transform: scale(1.7); opacity: 0; }
            }
          `}</style>
        </div>

        {/* Authentication Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultTab={authInitialTab}
        />
      </div>
    </>
  );
};

export default HomePage;
