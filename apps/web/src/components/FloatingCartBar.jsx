import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/contexts/CartContext.jsx';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const FloatingCartBar = () => {
  const { cartItems, getCartTotal, getCartCount } = useCart();
  const navigate = useNavigate();

  const itemCount = getCartCount();
  const total = getCartTotal();

  return (
    <AnimatePresence>
      {cartItems.length > 0 && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{
            type: 'tween',
            ease: 'easeOut',
            duration: 0.3,
            exit: { ease: 'easeIn', duration: 0.2 }
          }}
          className="fixed bottom-0 left-0 right-0 z-[100] flex items-center justify-between md:hidden bg-[#1a1a1a] border-t-2 border-[#F5A800] rounded-t-[16px] px-[20px] py-[12px] pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(245,168,0,0.2)]"
        >
          <div className="flex flex-col items-center justify-center">
            <div className="w-[28px] h-[28px] rounded-full bg-[#F5A800] flex items-center justify-center text-black font-bold text-sm leading-none">
              {itemCount}
            </div>
            <span className="text-[#888] text-[10px] font-bold mt-1 tracking-wider">
              EN TU PEDIDO
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-white font-bold text-[18px]">
              {formatPrice(total)}
            </span>
            <button
              onClick={() => navigate('/carrito')}
              className="bg-[#F5A800] text-black font-bold text-[14px] rounded-[8px] px-[20px] py-[10px] hover:bg-[#F5A800]/90 transition-all duration-200 active:scale-95"
            >
              VER PEDIDO →
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingCartBar;
