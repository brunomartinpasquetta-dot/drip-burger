import { useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';

// Hook que devuelve banners activos y vigentes según fecha actual,
// ordenados por `orden` ASC. Suscribe a cambios en tiempo real para
// que el carousel del home reaccione sin recargar.
//
// `onlyVisible = false` retorna todos (uso admin: ver inactivos/fuera de fecha).
const isVigente = (b, now) => {
  if (b.desde) {
    const d = new Date(b.desde);
    if (!Number.isNaN(d.getTime()) && d > now) return false;
  }
  if (b.hasta) {
    const h = new Date(b.hasta);
    if (!Number.isNaN(h.getTime()) && h < now) return false;
  }
  return true;
};

const filterAndSort = (items, onlyVisible) => {
  const now = new Date();
  const arr = (items || []).slice();
  arr.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  if (!onlyVisible) return arr;
  return arr.filter((b) => b.activo && isVigente(b, now));
};

export default function useBanners({ onlyVisible = true } = {}) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = null;

    const load = async () => {
      try {
        const res = await pb.collection('banners').getFullList({
          sort: 'orden,created',
          requestKey: null,
        });
        if (mounted) {
          setBanners(filterAndSort(res, onlyVisible));
          setError(null);
        }
      } catch (err) {
        console.error('[useBanners] load failed:', err);
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    // Tick cada 60s para reevaluar vigencia por fecha (sin tocar PB).
    const tick = setInterval(() => {
      if (mounted) setBanners((prev) => filterAndSort(prev, onlyVisible));
    }, 60000);

    // Realtime: cuando admin crea/edita/borra, refrescamos lista completa.
    (async () => {
      try {
        unsubscribe = await pb.collection('banners').subscribe('*', () => {
          load();
        });
      } catch (err) {
        console.warn('[useBanners] subscribe failed (best-effort):', err?.message);
      }
    })();

    return () => {
      mounted = false;
      clearInterval(tick);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [onlyVisible]);

  return { banners, loading, error };
}
