
import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product, pattyCount = 1, quantity = 1) => {
    setCartItems(prev => {
      // Find if the exact same product with the exact same configuration (pattyCount) is already in the cart
      const existingIndex = prev.findIndex(
        item => item.productId === product.id && item.pattyCount === pattyCount
      );

      // If it exists, accumulate the quantity
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }

      // If it doesn't exist, add it as a new item
      return [...prev, {
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        price: product.price,
        pattyCount,
        quantity
      }];
    });
  };

  const updateQuantity = (productId, pattyCount, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId, pattyCount);
      return;
    }

    setCartItems(prev =>
      prev.map(item =>
        item.productId === productId && item.pattyCount === pattyCount
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const updatePattyCount = (productId, oldPattyCount, newPattyCount) => {
    setCartItems(prev =>
      prev.map(item =>
        item.productId === productId && item.pattyCount === oldPattyCount
          ? { ...item, pattyCount: newPattyCount }
          : item
      )
    );
  };

  const removeFromCart = (productId, pattyCount) => {
    setCartItems(prev =>
      prev.filter(item => !(item.productId === productId && item.pattyCount === pattyCount))
    );
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('cart');
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const value = {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    updateQuantity,
    updatePattyCount,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartCount
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
