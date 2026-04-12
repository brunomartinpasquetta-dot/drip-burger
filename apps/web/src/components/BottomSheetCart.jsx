
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext.jsx';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const BottomSheetCart = () => {
  const { 
    isCartOpen, 
    setIsCartOpen, 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    getCartTotal 
  } = useCart();
  
  const navigate = useNavigate();

  const handleViewFullOrder = () => {
    setIsCartOpen(false);
    navigate('/carrito');
  };

  const subtotal = getCartTotal();

  return (
    <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
      <DrawerContent className="h-[50vh] flex flex-col bg-[#1a1a1a] border-t-2 border-[#F5A800] rounded-t-2xl shadow-[0_-4px_20px_rgba(245,168,0,0.2)]">
        <DrawerHeader className="border-b border-border px-4 py-3 shrink-0">
          <DrawerTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-white">
            <ShoppingBag className="w-5 h-5 text-[#F5A800]" />
            Tu Carrito
          </DrawerTitle>
        </DrawerHeader>

        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-bold uppercase tracking-wide mb-1 text-white">Carrito Vacío</p>
            <p className="text-muted-foreground text-xs font-medium">
              Aún no agregaste nada
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const imageUrl = item.productImage
                    ? `${pb.baseUrl}/api/files/products/${item.productId}/${item.productImage}`
                    : null;

                  return (
                    <div key={`${item.productId}-${item.pattyCount}`} className="flex gap-3 items-start">
                      <div className="w-16 h-16 bg-[#0a0a0a] rounded-lg shrink-0 overflow-hidden flex items-center justify-center border border-border">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-black uppercase text-xs truncate pr-2 text-white">{item.productName}</h3>
                          <button 
                            onClick={() => removeFromCart(item.productId, item.pattyCount)}
                            className="text-muted-foreground hover:text-destructive transition-all duration-200"
                            aria-label="Eliminar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          {item.pattyCount} Medallones
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1 bg-background rounded-md border border-border p-0.5">
                            <button
                              className="h-6 w-6 flex items-center justify-center hover:bg-[#F5A800] hover:text-black rounded transition-all duration-200 disabled:opacity-50 active:scale-95"
                              onClick={() => updateQuantity(item.productId, item.pattyCount, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              aria-label="Disminuir cantidad"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center font-bold text-xs text-white">{item.quantity}</span>
                            <button
                              className="h-6 w-6 flex items-center justify-center hover:bg-[#F5A800] hover:text-black rounded transition-all duration-200 active:scale-95"
                              onClick={() => updateQuantity(item.productId, item.pattyCount, item.quantity + 1)}
                              aria-label="Aumentar cantidad"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          
                          <span className="font-black text-[#F5A800] text-sm">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="px-4 py-3 border-t border-border bg-[#0a0a0a]/50 shrink-0">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subtotal</span>
                <span className="text-2xl font-black text-[#F5A800]">
                  {formatPrice(subtotal)}
                </span>
              </div>
              
              <Button 
                onClick={handleViewFullOrder}
                className="w-full h-12 text-sm font-black uppercase tracking-widest bg-[#F5A800] text-black hover:bg-[#F5A800]/90 transition-all duration-200 active:scale-[0.98]"
              >
                Ver Pedido Completo
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default BottomSheetCart;
