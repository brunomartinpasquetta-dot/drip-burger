import { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';

// Parsea "HH:mm" a minutos desde medianoche. Devuelve null si es inválido.
const parseTimeToMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
};

// Determina si el local está abierto ahora mismo.
// Soporta cruce de medianoche (ej. abre 20:00, cierra 02:00).
// Si la configuración está incompleta, tratamos como CERRADO por seguridad
// para evitar aceptar pedidos cuando el admin olvidó setear horarios.
export const computeIsOpen = (horaApertura, horaCierre, now = new Date()) => {
  const openMin = parseTimeToMinutes(horaApertura);
  const closeMin = parseTimeToMinutes(horaCierre);
  if (openMin === null || closeMin === null) return false;

  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (closeMin > openMin) {
    // Mismo día: 20:00 → 23:00
    return nowMin >= openMin && nowMin < closeMin;
  }
  // Cruza medianoche: 20:00 → 02:00
  return nowMin >= openMin || nowMin < closeMin;
};

export const useStoreHours = () => {
  const [horaApertura, setHoraApertura] = useState('');
  const [horaCierre, setHoraCierre] = useState('');
  const [loading, setLoading] = useState(true);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = null;
    let timeoutId = null;

    const doLoad = async () => {
      try {
        const records = await pb.collection('settings').getList(1, 1, { requestKey: null });
        if (!mounted) return;
        if (records.items.length > 0) {
          const s = records.items[0];
          setHoraApertura(s.hora_apertura || '');
          setHoraCierre(s.hora_cierre || '');
        }
      } catch (error) {
        console.error('[useStoreHours] failed to load settings:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Si hay datos de auth pendientes de hidratar y el authStore aún no los
    // levantó, esperamos al primer onChange (o a un fallback de 300ms) antes
    // de disparar el fetch. Esto evita el race entre la navegación post-login
    // y el mount del hook — el settings collection suele ser public pero en
    // caso de rules restrictivas, el request sin token se rechazaría.
    let hasPendingAuth = false;
    try {
      hasPendingAuth =
        (typeof localStorage !== 'undefined' && !!localStorage.getItem('pocketbase_auth')) ||
        (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('pocketbase_auth'));
    } catch (e) {
      hasPendingAuth = false;
    }

    if (hasPendingAuth && !pb.authStore.isValid) {
      unsubscribe = pb.authStore.onChange(() => {
        if (!mounted) return;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        doLoad();
      });
      timeoutId = setTimeout(() => {
        if (!mounted) return;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        timeoutId = null;
        doLoad();
      }, 300);
    } else {
      doLoad();
    }

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Re-render cada 60 segundos para que isOpen se mantenga actualizado
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const isOpen = computeIsOpen(horaApertura, horaCierre);

  return { horaApertura, horaCierre, isOpen, loading };
};
