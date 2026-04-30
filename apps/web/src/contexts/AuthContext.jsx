
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
    // El SDK de PocketBase ya hidrata pb.authStore desde localStorage en su
    // constructor (LocalAuthStore por default). No necesitamos interceptar
    // save/clear — el wrapper custom anterior rompía la persistencia.
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

  // El 3er parámetro rememberMe se ignora — siempre persistimos en localStorage.
  // Se mantiene en la firma para no romper LoginPage/AuthModal que lo pasan.
  // Estrategia dual collection: probamos primero `clientes` (la mayoría de
  // logins son del checkout) y caemos a `users` (admin/staff). El record
  // resultante trae .collectionName para que la UI sepa con qué está tratando.
  // eslint-disable-next-line no-unused-vars
  const login = async (email, password, rememberMe = true) => {
    let lastError = null;
    for (const coll of ['clientes', 'users']) {
      try {
        const authData = await pb.collection(coll).authWithPassword(email, password, { requestKey: null });
        setCurrentUser(authData.record);
        return authData.record;
      } catch (err) {
        lastError = err;
      }
    }
    console.warn('[auth] login falló en clientes y users:', lastError?.message);
    throw new Error('Correo o contraseña inválidos');
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
    navigate('/');
  };

  // Admin = role ADMIN dentro de la collection `users`. Los `clientes` nunca
  // tienen role=ADMIN (la collection ni siquiera tiene ese campo).
  const isAdmin =
    currentUser?.collectionName === 'users' && currentUser?.role === 'ADMIN';
  const isCliente = currentUser?.collectionName === 'clientes';

  const value = {
    currentUser,
    login,
    logout,
    isAdmin,
    isCliente,
    isAuthenticated: !!currentUser,
    // isAuthReady = pb.authStore ya fue hidratado (sea con token válido o sin sesión).
    // Los consumers que disparan fetchs sensibles a la auth deben esperar a este flag
    // antes de llamar al API para evitar requests sin Authorization header.
    isAuthReady: !initialLoading,
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
