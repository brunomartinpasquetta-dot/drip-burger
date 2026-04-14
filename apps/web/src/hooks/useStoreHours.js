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
// Si no hay horarios configurados → considera abierto (default tolerante).
export const computeIsOpen = (horaApertura, horaCierre, now = new Date()) => {
  const openMin = parseTimeToMinutes(horaApertura);
  const closeMin = parseTimeToMinutes(horaCierre);
  if (openMin === null || closeMin === null) return true;

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
    (async () => {
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
    })();
    return () => { mounted = false; };
  }, []);

  // Re-render cada 60 segundos para que isOpen se mantenga actualizado
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const isOpen = computeIsOpen(horaApertura, horaCierre);

  return { horaApertura, horaCierre, isOpen, loading };
};
