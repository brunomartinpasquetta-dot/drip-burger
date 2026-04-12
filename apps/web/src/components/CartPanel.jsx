
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext.jsx';
import pb from '@/lib/pocketbaseClient';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const CartPanel = () => {
  const { 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    getCartTotal 
  } = useCart();
  
  const navigate = useNavigate();

  const handleCheckout = () => {
    navigate('/checkout');
  };

  const subtotal = getCartTotal();

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border/50 shrink-0 bg-[#1a1a1a] z-10 shadow-sm">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center gap-2 text-white">
          <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Carrito
        </h2>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden relative">
        {cartItems.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-sm md:text-lg font-bold uppercase tracking-wide mb-2 text-white/80">Carrito Vacío</p>
            <p className="text-white/50 text-xs md:text-sm font-medium">
              Agregá productos desde el menú
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full custom-scrollbar">
            <div className="p-3 md:p-6 space-y-4 md:space-y-6">
              {cartItems.map((item) => {
                const imageUrl = item.productImage
                  ? `${pb.baseUrl}/api/files/products/${item.productId}/${item.productImage}`
                  : null;

                return (
                  <div key={`${item.productId}-${item.pattyCount}`} className="flex flex-col xl:flex-row gap-3 items-start border-b border-white/10 pb-4 last:border-0 last:pb-0">
                    {/* Hide image on very small mobile columns to save space, show on larger */}
                    <div className="hidden lg:flex w-16 h-16 bg-[#0a0a0a] rounded-lg shrink-0 overflow-hidden items-center justify-center border border-white/10">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-white/30" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-black uppercase text-xs md:text-sm text-white line-clamp-2 pr-2 leading-tight">
                          {item.productName}
                        </h3>
                        <button 
                          onClick={() => removeFromCart(item.productId, item.pattyCount)}
                          className="text-white/40 hover:text-destructive transition-colors shrink-0"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </button>
                      </div>
                      
                      <p className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider mb-2">
                        {item.pattyCount} {item.pattyCount === 1 ? 'Medallón' : 'Medallones'}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                        <div className="flex items-center space-x-1 bg-black/40 rounded-md border border-white/10 p-0.5 w-fit">
                          <button
                            className="h-6 w-6 md:h-7 md:w-7 flex items-center justify-center hover:bg-primary hover:text-primary-foreground text-white rounded transition-colors disabled:opacity-50"
                            onClick={() => updateQuantity(item.productId, item.pattyCount, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 md:w-6 text-center font-bold text-[10px] md:text-xs text-white">
                            {item.quantity}
                          </span>
                          <button
                            className="h-6 w-6 md:h-7 md:w-7 flex items-center justify-center hover:bg-primary hover:text-primary-foreground text-white rounded transition-colors"
                            onClick={() => updateQuantity(item.productId, item.pattyCount, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        
                        <span className="font-black text-white text-xs md:text-sm">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer / Subtotal */}
      {cartItems.length > 0 && (
        <div className="p-4 md:p-6 border-t border-border/50 shrink-0 bg-[#141414]">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex justify-between items-center text-white/70">
              <span className="text-xs md:text-sm font-bold uppercase tracking-wider">Subtotal</span>
              <span className="text-sm md:text-base font-black">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-white">Total</span>
              <span className="text-lg md:text-2xl font-black text-primary">
                {formatPrice(subtotal)}
              </span>
            </div>
          </div>
          
          <Button 
            onClick={handleCheckout}
            className="w-full h-12 md:h-14 text-sm md:text-lg font-black uppercase tracking-widest btn-primary shadow-lg shadow-primary/20"
          >
            Ir al Pedido
          </Button>
        </div>
      )}
    </div>
  );
};

export default CartPanel;
