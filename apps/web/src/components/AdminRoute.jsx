
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, isAuthReady } = useAuth();

  // Mientras pb.authStore todavía no terminó de hidratar, no redirigimos ni
  // renderizamos children — mostramos el mismo spinner del resto del admin
  // para evitar una carrera donde los useEffect hijos disparan fetchs sin token.
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground font-bold uppercase tracking-wider text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/menu" replace />;
  }

  return children;
};

export default AdminRoute;
