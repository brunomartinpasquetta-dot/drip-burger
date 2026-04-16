
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCart } from '@/contexts/CartContext.jsx';
import { Menu, X, ShoppingCart, User, LogOut, LayoutDashboard, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AuthModal from '@/components/AuthModal.jsx';

const Header = () => {
  const { isAuthenticated, isAdmin, currentUser, logout } = useAuth();
  const { getCartCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const cartCount = getCartCount();
  const isActive = (path) => location.pathname === path;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/" className="flex items-center space-x-2">
                <img
                  src="https://horizons-cdn.hostinger.com/275f7838-3e15-483d-8eea-e9521d942912/cf52b8972fd221515cb37ac167cfd2a2.png"
                  alt="DRIP BURGER Logo"
                  className="w-10 h-10 sm:w-11 sm:h-11 object-contain"
                />
                <div className="hidden sm:flex flex-col">
                  <span className="text-base sm:text-lg font-black uppercase tracking-wider text-primary leading-tight">DRIP BURGER</span>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-secondary leading-tight">Streetwear Burgers</span>
                </div>
              </Link>
              <div className="flex flex-col ml-2 sm:ml-4">
                <span aria-hidden className="hidden sm:block text-base sm:text-lg font-black uppercase tracking-wider leading-tight invisible">.</span>
                <span className="font-mono text-[9px] sm:text-[10px] font-normal tracking-tight text-white/70 leading-tight whitespace-nowrap">
                  <span className="text-xs sm:text-sm align-middle">©</span> 2026 · Crafted by BPSG
                </span>
              </div>
            </div>

            {/* Desktop Navigation — el link Menú se movió a la HomePage (botón + carousel).
                Reportes vive dentro del panel admin. Este nav queda vacío por ahora. */}
            <nav className="hidden md:flex items-center space-x-8" />

            {/* Global Actions Container (Mobile + Desktop) */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              
              {/* Cart Icon */}
              <div className="relative flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:text-primary hover:bg-primary/10 transition-colors relative h-10 w-10 sm:h-11 sm:w-11"
                  onClick={() => navigate('/carrito')}
                  aria-label="Ir al carrito"
                >
                  <ShoppingCart className="!h-8 !w-8 sm:!h-9 sm:!w-9" />
                  {cartCount > 0 && (
                    <span className="absolute top-0 right-0 bg-[#F5A800] text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-md border-2 border-background">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </div>

              {/* Desktop User Actions */}
              <div className="hidden md:flex items-center space-x-4">
                {!isAuthenticated ? (
                  <Button
                    variant="default"
                    className="btn-primary font-bold uppercase tracking-wide text-xs h-9 px-3"
                    onClick={() => setIsAuthModalOpen(true)}
                  >
                    <User className="w-4 h-4 mr-1.5" />
                    MI CUENTA
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="hover:text-primary hover:bg-primary/10 transition-colors h-10 w-10">
                        <User className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border w-48">
                      <div className="px-2 py-2 border-b border-border mb-1">
                        <p className="text-sm font-bold uppercase text-primary truncate">
                          {currentUser?.nombre_apellido || currentUser?.name || 'Usuario'}
                        </p>
                      </div>
                      {isAdmin && (
                        <>
                          <DropdownMenuItem asChild className="focus:bg-primary/20 focus:text-primary cursor-pointer">
                            <Link to="/gestion" className="font-medium uppercase text-xs flex items-center">
                              <LayoutDashboard className="mr-2 h-4 w-4" />
                              Panel de Admin
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="focus:bg-primary/20 focus:text-primary cursor-pointer">
                            <Link to="/gestion/reportes" className="font-medium uppercase text-xs flex items-center">
                              <LineChart className="mr-2 h-4 w-4" />
                              Reportes
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={logout} className="focus:bg-destructive/20 focus:text-destructive text-destructive cursor-pointer font-medium uppercase text-xs mt-1 border-t border-border pt-2">
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {isAuthenticated && isAdmin && (
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-wide text-xs h-9 px-3"
                  >
                    <Link to="/gestion">
                      <LayoutDashboard className="w-4 h-4 mr-1.5" />
                      PANEL ADMIN
                    </Link>
                  </Button>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden text-foreground hover:text-primary transition-colors relative p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6 sm:h-7 sm:w-7" /> : <Menu className="h-6 w-6 sm:h-7 sm:w-7" />}
              </button>

            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2 border-t border-border bg-background animate-in slide-in-from-top-2">
              <Link
                to="/carrito"
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-3" />
                  <span>Carrito</span>
                </div>
                {cartCount > 0 && (
                  <span className="bg-[#F5A800] text-white text-xs font-bold rounded-full px-2 py-1 shadow-sm">
                    {cartCount}
                  </span>
                )}
              </Link>

              {!isAuthenticated ? (
                <div className="pt-4 mt-2 border-t border-border px-4">
                  <Button 
                    className="w-full btn-primary font-bold uppercase tracking-wide h-12" 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsAuthModalOpen(true);
                    }}
                  >
                    <User className="w-5 h-5 mr-2" />
                    MI CUENTA
                  </Button>
                </div>
              ) : (
                <>
                  {isAdmin && (
                    <div className="pt-4 mt-2 border-t border-border">
                      <p className="px-4 text-xs font-bold text-muted-foreground uppercase mb-2">Administración</p>
                      <Link
                        to="/gestion"
                        className="block px-4 py-3 text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Panel de Admin
                      </Link>
                      <Link
                        to="/gestion/reportes"
                        className="block px-4 py-3 text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Reportes
                      </Link>
                    </div>
                  )}
                  <div className="pt-4 mt-2 border-t border-border">
                    <button
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center px-4 py-3 text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-destructive/10 text-destructive transition-colors mt-2"
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Cerrar Sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  );
};

export default Header;
