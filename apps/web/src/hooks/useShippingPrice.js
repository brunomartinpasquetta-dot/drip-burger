import { useState, useEffect, useMemo } from 'react';
import pb from '@/lib/pocketbaseClient';
import { determinarZona } from '@/lib/shippingZone';

export const useShippingPrice = (direccion = '') => {
  const [precios, setPrecios] = useState({ centro: 0, alejado: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const records = await pb.collection('settings').getList(1, 1, { requestKey: null });
        if (!mounted) return;
        if (records.items.length > 0) {
          const rec = records.items[0];
          const legacy = Number(rec.precio_envio) || 0;
          const centro = rec.precio_envio_centro != null
            ? Number(rec.precio_envio_centro) || 0
            : legacy;
          const alejado = rec.precio_envio_alejado != null
            ? Number(rec.precio_envio_alejado) || 0
            : legacy;
          setPrecios({ centro, alejado });
        }
      } catch (err) {
        console.error('Error fetching shipping price:', err);
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const trimmed = (direccion || '').trim();
  const zona = useMemo(
    () => (trimmed ? determinarZona(trimmed) : null),
    [trimmed]
  );

  // Sin dirección: preview con precio centro. Con dirección: precio según zona.
  const shippingPrice = zona === 'alejada' ? precios.alejado : precios.centro;

  const formatShipping = (price) => {
    if (price === 0) {
      return {
        isFree: true,
        text: 'Envío gratis 🛵',
        formattedPrice: '$0,00',
      };
    }
    const formatted = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
    return {
      isFree: false,
      text: `Envío: ${formatted}`,
      formattedPrice: formatted,
    };
  };

  return { shippingPrice, zona, precios, loading, error, formatShipping };
};
