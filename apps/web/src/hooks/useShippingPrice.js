
import { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';

export const useShippingPrice = () => {
  const [shippingPrice, setShippingPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchShippingPrice = async () => {
      try {
        setLoading(true);
        const records = await pb.collection('settings').getList(1, 1, { $autoCancel: false });
        if (records.items.length > 0) {
          setShippingPrice(records.items[0].precio_envio || 0);
        }
      } catch (err) {
        console.error('Error fetching shipping price:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchShippingPrice();
  }, []);

  const formatShipping = (price) => {
    if (price === 0) {
      return {
        isFree: true,
        text: 'Envío gratis 🛵',
        formattedPrice: '$0,00'
      };
    }
    const formatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price);
    return {
      isFree: false,
      text: `Envío: ${formatted}`,
      formattedPrice: formatted
    };
  };

  return { shippingPrice, loading, error, formatShipping };
};
