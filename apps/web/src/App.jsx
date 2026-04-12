
import React, { useState, useEffect } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { CartProvider } from './contexts/CartContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import ScrollToTop from './components/ScrollToTop.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CustomerMenuPage from './pages/CustomerMenuPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import SalesReportingPage from './pages/SalesReportingPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { Toaster } from '@/components/ui/sonner';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('drip_splash_seen');
    if (hasSeenSplash) {
      setShowSplash(false);
    }
  }, []);

  useEffect(() => {
    const initializeProducts = async () => {
      const hasInitialized = sessionStorage.getItem('drip_products_initialized');
      if (hasInitialized) {
        return;
      }

      try {
        const response = await apiServerClient.fetch('/products/init-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        console.log('Products initialization:', data);
        sessionStorage.setItem('drip_products_initialized', 'true');
      } catch (error) {
        console.error('Failed to initialize products:', error);
      }
    };

    initializeProducts();
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem('drip_splash_seen', 'true');
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <CartDrawer />
          <ScrollToTop />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<CustomerMenuPage />} />
            <Route path="/carrito" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected Admin Routes */}
            <Route
              path="/gestion"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/gestion/reportes"
              element={
                <AdminRoute>
                  <SalesReportingPage />
                </AdminRoute>
              }
            />
            <Route
              path="/gestion/configuracion"
              element={
                <AdminRoute>
                  <SettingsPage />
                </AdminRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster theme="dark" />
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
