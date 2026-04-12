
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import AuthModal from '@/components/AuthModal.jsx';
import { Button } from '@/components/ui/button';
import { Truck, CreditCard, Flame, Instagram, MessageCircle, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

const HomePage = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      const now = new Date();
      const hours = now.getHours();
      // Open between 20:00 and 23:00
      if (hours >= 20 && hours < 23) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Helmet>
        <title>DRIP BURGER - Streetwear Burgers</title>
        <meta name="description" content="DRIP BURGER. No venimos a competir, venimos a marcar la diferencia, mordida a mordida." />
      </Helmet>

      <div className="min-h-screen bg-background selection:bg-primary selection:text-black flex flex-col">
        <Header />

        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
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
                className="mb-8 flex justify-center"
              >
                <img 
                  src="https://horizons-cdn.hostinger.com/275f7838-3e15-483d-8eea-e9521d942912/cf52b8972fd221515cb37ac167cfd2a2.png" 
                  alt="DRIP BURGER Mascot" 
                  className="w-48 h-48 object-contain drop-shadow-[0_0_30px_rgba(245,168,0,0.3)]"
                />
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6"
                style={{ color: 'var(--accent-orange)' }}
              >
                DRIP BURGER
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl md:text-2xl text-muted-foreground mb-10 font-medium max-w-2xl mx-auto leading-relaxed"
              >
                No venimos a competir, venimos a marcar la diferencia, mordida a mordida.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                {!isAuthenticated && (
                  <>
                    <Button asChild size="lg" className="btn-primary text-lg px-10 h-14">
                      <Link to="/menu">Ver Menú</Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="btn-secondary text-lg px-10 h-14"
                      onClick={() => setShowAuthModal(true)}
                    >
                      Ingresar
                    </Button>
                  </>
                )}
                {isAuthenticated && !isAdmin && (
                  <Button asChild size="lg" className="btn-primary text-lg px-10 h-14">
                    <Link to="/menu">Pedir Ahora</Link>
                  </Button>
                )}
                {isAuthenticated && isAdmin && (
                  <Button asChild size="lg" className="btn-primary text-lg px-10 h-14">
                    <Link to="/admin">Panel Admin</Link>
                  </Button>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-card border-y border-border relative overflow-hidden flex-none">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
          <div className="container mx-auto px-2 sm:px-4 relative z-10 max-w-4xl">
            <div className="flex flex-row justify-center items-stretch gap-3 sm:gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="bg-background p-3 sm:p-4 rounded-xl border border-border hover:border-primary/50 transition-colors group flex-1 min-w-0 flex flex-col items-center justify-center text-center shadow-sm"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors">
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wide truncate w-full px-1">A Tu Medida</h3>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
                className="bg-background p-3 sm:p-4 rounded-xl border border-border hover:border-primary/50 transition-colors group flex-1 min-w-0 flex flex-col items-center justify-center text-center shadow-sm"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wide truncate w-full px-1">Delivery Fast</h3>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true }}
                className="bg-background p-3 sm:p-4 rounded-xl border border-border hover:border-primary/50 transition-colors group flex-1 min-w-0 flex flex-col items-center justify-center text-center shadow-sm"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wide truncate w-full px-1">Pago Easy</h3>
              </motion.div>
            </div>
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
              className="mb-8 font-black uppercase tracking-widest text-sm md:text-base bg-background/20 px-6 py-2 rounded-full shadow-inner"
            >
              {isOpen ? (
                <span className="text-[#22c55e] flex items-center justify-center gap-2">
                  <span className="text-[10px]">●</span> ABIERTO
                </span>
              ) : (
                <span className="text-[#ef4444] flex items-center justify-center gap-2">
                  <span className="text-[10px]">●</span> CERRADO
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
        />
      </div>
    </>
  );
};

export default HomePage;
