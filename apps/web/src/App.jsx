
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { CartProvider } from './contexts/CartContext.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CustomerMenuPage from './pages/CustomerMenuPage.jsx';
import CartPage from './pages/CartPage.jsx';
import ConfirmationPage from './pages/ConfirmationPage.jsx';
import { PaymentSuccessPage, PaymentFailedPage, PaymentPendingPage } from './pages/PaymentReturnPages.jsx';
import { Toaster } from '@/components/ui/sonner';

// Rutas admin lazy-loaded — no bloquean el bundle inicial del cliente,
// que es el 95% del tráfico. AdminDashboard trae recharts, ZonasAdmin
// trae leaflet + geoman (>500KB combinados).
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const SalesReportingPage = lazy(() => import('./pages/SalesReportingPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const EditOrdersPage = lazy(() => import('./pages/EditOrdersPage.jsx'));
const ZonasAdmin = lazy(() => import('./pages/admin/ZonasAdmin.jsx'));

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('drip_splash_seen');
    if (hasSeenSplash) {
      setShowSplash(false);
    }
    // Pre-cargar zonas + centro/config del local al boot. Si fallan
    // (PB no responde, network), el zonificador cae al fallback JSON
    // bundleado y a las coords default — no rompe el checkout.
    import('@/lib/zonasLoader').then((m) => m.loadZonas()).catch(() => {});
    import('@/lib/localCenterLoader').then((m) => m.loadLocalCenter()).catch(() => {});
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
          <ScrollToTop />
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<CustomerMenuPage />} />
            <Route path="/carrito" element={<CartPage />} />
            <Route path="/confirmacion/:orderId" element={<ConfirmationPage />} />
            <Route path="/pedido-confirmado/:orderId" element={<PaymentSuccessPage />} />
            <Route path="/pedido-fallido/:orderId" element={<PaymentFailedPage />} />
            <Route path="/pedido-pendiente/:orderId" element={<PaymentPendingPage />} />
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
              path="/gestion/config"
              element={
                <AdminRoute>
                  <SettingsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/gestion/editar-pedidos"
              element={
                <AdminRoute>
                  <EditOrdersPage />
                </AdminRoute>
              }
            />
            <Route
              path="/gestion/zonas"
              element={
                <AdminRoute>
                  <ZonasAdmin />
                </AdminRoute>
              }
            />
            {/* Alias legacy — redirige al nuevo path */}
            <Route path="/gestion/configuracion" element={<Navigate to="/gestion/config" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          <Toaster theme="dark" />
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
