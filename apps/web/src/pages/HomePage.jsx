
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useStoreHours } from '@/hooks/useStoreHours';
import Header from '@/components/Header.jsx';
import AuthModal from '@/components/AuthModal.jsx';
import ProductCard from '@/components/ProductCard.jsx';
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
  const { isOpen, horaApertura, horaCierre } = useStoreHours();
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
          sort: 'name',
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
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="mb-8 md:mb-4 flex justify-center"
              >
                <img
                  src="https://horizons-cdn.hostinger.com/275f7838-3e15-483d-8eea-e9521d942912/cf52b8972fd221515cb37ac167cfd2a2.png"
                  alt="DRIP BURGER Mascot"
                  className="w-48 h-48 md:w-36 md:h-36 object-contain drop-shadow-[0_0_30px_rgba(245,168,0,0.3)]"
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-6xl font-black uppercase tracking-tighter mb-6 md:mb-3"
                style={{ color: 'var(--accent-orange)' }}
              >
                DRIP BURGER
              </motion.h1>

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

        {/* Location & Social Media Section */}
        <section className="py-24 bg-[#1a1a1a] flex-1">
          <div className="container mx-auto px-4 flex flex-col items-center text-center">
            
            {/* Status Indicator */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mb-8 font-black uppercase tracking-widest text-sm md:text-base bg-background/20 px-6 py-2 rounded-full shadow-inner flex items-center justify-center gap-3"
            >
              {isOpen ? (
                <span className="text-[#22c55e] flex items-center gap-2">
                  <span className="text-[10px]">●</span> ABIERTO
                </span>
              ) : (
                <span className="text-[#ef4444] flex items-center gap-2">
                  <span className="text-[10px]">●</span> CERRADO
                </span>
              )}
              {horaApertura && horaCierre && (
                <span className="text-muted-foreground text-xs md:text-sm tabular-nums font-bold normal-case tracking-wide">
                  {horaApertura} – {horaCierre}
                </span>
              )}
            </motion.div>
            
            {/* Location Info */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="space-y-3 mb-12"
            >
              <p className="text-white text-lg md:text-2xl font-bold tracking-wide">Av. Ejemplo 123, Coronda, Santa Fe</p>
              <p className="text-gray-400 font-medium md:text-lg">Lun a Dom · 20:30 a 23:00</p>
            </motion.div>

            {/* Social Icons */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
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
                href="https://maps.google.com/?q=Coronda,SantaFe" 
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

        {/* Floating WhatsApp Button */}
        <a
          href="https://wa.me/5493425245092"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-[80px] left-[16px] w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:shadow-2xl hover:scale-110 transition-all duration-300 z-50"
          aria-label="Contact us on WhatsApp"
          title="Chat with us on WhatsApp"
        >
          <MessageCircle className="w-7 h-7 text-white" />
        </a>

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
