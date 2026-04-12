
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext.jsx';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import BottomSheetCart from '@/components/BottomSheetCart.jsx';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const CartDrawer = () => {
  const isMobile = useIsMobile();
  
  const { 
    isCartOpen, 
    setIsCartOpen, 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    getCartTotal 
  } = useCart();
  
  const navigate = useNavigate();

  // On mobile, render BottomSheetCart instead
  if (isMobile) {
    return <BottomSheetCart />;
  }

  // Desktop: existing Sheet behavior
  const handleCheckout = () => {
    setIsCartOpen(false);
    navigate('/carrito');
  };

  const handleContinueShopping = () => {
    setIsCartOpen(false);
    navigate('/menu');
  };

  const subtotal = getCartTotal();

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0 border-l border-border bg-background">
        <SheetHeader className="p-6 border-b border-border text-left">
          <SheetTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Tu Carrito
          </SheetTitle>
        </SheetHeader>

        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mb-6">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <p className="text-xl font-bold uppercase tracking-wide mb-2">Carrito Vacío</p>
            <p className="text-muted-foreground text-sm font-medium mb-8">
              Aún no agregaste nada. ¡Es hora de un buen DRIP!
            </p>
            <Button onClick={handleContinueShopping} className="btn-primary w-full h-12 text-md">
              Ver Menú
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-6">
                {cartItems.map((item) => {
                  const imageUrl = item.productImage
                    ? `${pb.baseUrl}/api/files/products/${item.productId}/${item.productImage}`
                    : null;

                  return (
                    <div key={`${item.productId}-${item.pattyCount}`} className="flex gap-4 items-start">
                      <div className="w-20 h-20 bg-[#0a0a0a] rounded-lg shrink-0 overflow-hidden flex items-center justify-center border border-border">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-black uppercase text-sm truncate pr-2">{item.productName}</h3>
                          <button 
                            onClick={() => removeFromCart(item.productId, item.pattyCount)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          {item.pattyCount} Medallones
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-1 bg-background rounded-md border border-border p-0.5">
                            <button
                              className="h-7 w-7 flex items-center justify-center hover:bg-primary hover:text-primary-foreground rounded transition-colors disabled:opacity-50"
                              onClick={() => updateQuantity(item.productId, item.pattyCount, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                            <button
                              className="h-7 w-7 flex items-center justify-center hover:bg-primary hover:text-primary-foreground rounded transition-colors"
                              onClick={() => updateQuantity(item.productId, item.pattyCount, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          
                          <span className="font-black text-primary">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="p-6 border-t border-border bg-card/50">
              <div className="flex justify-between items-end mb-6">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Subtotal</span>
                <span className="text-3xl font-black text-primary">
                  {formatPrice(subtotal)}
                </span>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={handleCheckout}
                  className="w-full h-14 text-lg font-black uppercase tracking-widest btn-primary"
                >
                  Ir a Pagar
                </Button>
                <Button 
                  onClick={handleContinueShopping}
                  variant="outline" 
                  className="w-full h-12 font-bold uppercase tracking-widest border-border hover:bg-muted text-foreground"
                >
                  Seguir Comprando
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
