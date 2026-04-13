
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Intercept PocketBase authStore to support sessionStorage (Remember Me = false)
    const setupStorage = () => {
      const originalSave = pb.authStore.save.bind(pb.authStore);
      const originalClear = pb.authStore.clear.bind(pb.authStore);

      pb.authStore.save = function(token, model) {
        originalSave(token, model); // Default writes to localStorage
        if (window.useSessionStorage) {
          const data = localStorage.getItem('pocketbase_auth');
          if (data) {
            sessionStorage.setItem('pocketbase_auth', data);
            localStorage.removeItem('pocketbase_auth');
          }
        } else {
          sessionStorage.removeItem('pocketbase_auth');
        }
      };

      pb.authStore.clear = function() {
        originalClear();
        sessionStorage.removeItem('pocketbase_auth');
      };

      // Restore from sessionStorage if it exists (page refresh when rememberMe was false)
      const sessionData = sessionStorage.getItem('pocketbase_auth');
      if (sessionData) {
        window.useSessionStorage = true;
        try {
          const parsed = JSON.parse(sessionData);
          pb.authStore.save(parsed.token, parsed.model);
        } catch (e) {
          console.error('Error parsing session auth data', e);
        }
      }
    };

    setupStorage();

    if (pb.authStore.isValid && pb.authStore.model) {
      setCurrentUser(pb.authStore.model);
    }
    setInitialLoading(false);

    const unsubscribe = pb.authStore.onChange((token, model) => {
      setCurrentUser(model);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email, password, rememberMe = false) => {
    try {
      window.useSessionStorage = !rememberMe;
      const authData = await pb.collection('users').authWithPassword(email, password, { requestKey: null });
      setCurrentUser(authData.record);
      return authData.record;
    } catch (error) {
      throw new Error('Correo o contraseña inválidos');
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
    navigate('/');
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  const value = {
    currentUser,
    login,
    logout,
    isAdmin,
    isAuthenticated: !!currentUser
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#F5A800] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-bold uppercase tracking-wider">Cargando...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
