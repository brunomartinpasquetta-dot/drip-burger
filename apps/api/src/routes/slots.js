import express from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Horarios fijos de entrega (hardcoded en el cliente también)
const SLOT_ORDER = ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'];
const DEFAULT_MAX_MEDALLIONS = 20;

/**
 * Calcula el rango UTC equivalente al "día actual" en zona Argentina (UTC-3, sin DST).
 * Ej: si son las 02:00 UTC del 15 abr (23:00 del 14 en AR), el día AR es el 14.
 */
const todayRangeArgentina = () => {
    const now = new Date();
    const arOffsetMs = -3 * 60 * 60 * 1000; // UTC-3
    const nowAr = new Date(now.getTime() + arOffsetMs);
    const year = nowAr.getUTCFullYear();
    const month = nowAr.getUTCMonth();
    const day = nowAr.getUTCDate();

    // Inicio del día AR = 00:00:00 AR = 03:00:00 UTC del mismo día calendario AR
    const startUtc = new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
    const endUtc = new Date(Date.UTC(year, month, day + 1, 3, 0, 0, 0));
    // PB almacena datetime como "YYYY-MM-DD HH:MM:SS.sssZ" (espacio, no T).
    // toISOString() usa T, lo cual hace fallar la comparación lexicográfica
    // contra el formato de DB si se usa en un filter string. T→espacio fix.
    return {
        startUtc: startUtc.toISOString().replace('T', ' '),
        endUtc: endUtc.toISOString().replace('T', ' '),
        dateAr: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
};

// Suma medallones de un array de items: (hasMedallions !== false ? pattyCount * quantity : 0)
// Acepta array nativo (PB le devuelve JSON parseado) o string JSON.
// Clampa pattyCount/quantity negativos a 0 defensivamente para que data mala
// de orders viejos no "regale" capacidad via agregación negativa.
const countMedallions = (items) => {
    let arr = items;
    if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { arr = null; }
    }
    if (!Array.isArray(arr)) return 0;
    let total = 0;
    for (const item of arr) {
        if (!item) continue;
        if (item.hasMedallions === false) continue;
        const patty = Math.max(0, Number(item.pattyCount) || 0);
        const qty = Math.max(0, Number(item.quantity) || 0);
        total += patty * qty;
    }
    return total;
};

/**
 * GET /slots/availability
 * Público (lo consume el CartPage del cliente).
 * Devuelve la capacidad global de medallones y el uso por cada tanda del día.
 */
// Devuelve el max de medallones para un slot dado. Prioridad:
//   1. slotCapacityPerSlot[slot] (config individual del admin)
//   2. DEFAULT_MAX_MEDALLIONS si nada está configurado
const resolveSlotMax = (perSlot, slot) => {
    if (perSlot && typeof perSlot === 'object') {
        const v = Number(perSlot[slot]);
        if (Number.isFinite(v) && v >= 0) return v;
    }
    return DEFAULT_MAX_MEDALLIONS;
};

router.get('/availability', async (req, res) => {
    try {
        // 1. Leer per-slot capacity de settings (sin global — cada slot es
        //    independiente).
        let slotCapacityPerSlot = null;
        try {
            const settings = await pb.collection('settings').getList(1, 1, { requestKey: null });
            if (settings.items.length > 0) {
                slotCapacityPerSlot = settings.items[0].slotCapacityPerSlot || null;
            }
        } catch (err) {
            logger.warn(`[slots/availability] cannot read settings, using default: ${err.message}`);
        }

        // 2. Leer orders del día
        const { startUtc, endUtc, dateAr } = todayRangeArgentina();
        // Excluimos:
        //   - Cancelados (obvio).
        //   - paymentStatus = "Rechazado" (MP devolvió fail — no es reserva real).
        //   - forma_pago = "Mercado Pago" con paymentStatus != "Pagado": son MP
        //     abandonados (el cliente arrancó el flow online y nunca pagó). Sin
        //     este filtro inflan la capacidad y bloquean clientes reales.
        // Las órdenes Efectivo / Transferencia se cuentan SIEMPRE (aunque sigan
        // Pendientes), porque son reservas reales que se cobran al delivery.
        const filter = `created >= "${startUtc}" && created < "${endUtc}" && orderStatus != "Cancelado" && paymentStatus != "Rechazado" && (forma_pago != "Mercado Pago" || paymentStatus = "Pagado")`;

        let todayOrders = [];
        try {
            todayOrders = await pb.collection('orders').getFullList({
                filter,
                requestKey: null,
            });
        } catch (err) {
            logger.error(`[slots/availability] cannot read orders: ${err.message}`);
            return res.status(500).json({ error: 'No se pudo leer el estado de tandas' });
        }

        // 3. Agrupar medallones por slot
        const usedBySlot = {};
        for (const order of todayOrders) {
            const slot = order.deliveryTimeSlot;
            if (!slot) continue;
            usedBySlot[slot] = (usedBySlot[slot] || 0) + countMedallions(order.items);
        }

        // 4. Armar respuesta por slot (ordenada cronológicamente)
        const slots = SLOT_ORDER.map((slot) => {
            const usedMedallions = usedBySlot[slot] || 0;
            const slotMax = resolveSlotMax(slotCapacityPerSlot, slot);
            const available = Math.max(0, slotMax - usedMedallions);
            return {
                slot,
                usedMedallions,
                max: slotMax,
                available,
                full: usedMedallions >= slotMax,
            };
        });

        return res.json({
            date: dateAr,
            slotCapacityPerSlot,
            slots,
        });
    } catch (err) {
        logger.error(`[slots/availability] ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

export default router;
