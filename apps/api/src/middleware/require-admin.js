import Pocketbase from 'pocketbase';
import logger from '../utils/logger.js';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';

/**
 * Middleware que exige un JWT de PocketBase en Authorization: Bearer <token>
 * y que el usuario tenga role === "ADMIN" en la collection users.
 *
 * Crea un cliente PB efímero por request (para no pisar el authStore del
 * cliente singleton usado en otros endpoints) y valida el token vía
 * authRefresh. Esto garantiza que el token sea válido y que el user exista.
 *
 * Side effect: req.adminUser y req.adminPbClient quedan disponibles para
 * handlers downstream que quieran leer/escribir PB como el usuario autenticado.
 */
export const requireAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
        return res.status(401).json({ error: 'Missing authorization token' });
    }

    const userPb = new Pocketbase(POCKETBASE_URL);
    userPb.autoCancellation(false);
    userPb.authStore.save(token, null);

    try {
        await userPb.collection('users').authRefresh();
    } catch (err) {
        logger.warn(`[requireAdmin] authRefresh failed: ${err?.message || err}`);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = userPb.authStore.model;
    if (!user) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin role required' });
    }

    req.adminUser = user;
    req.adminPbClient = userPb;
    next();
};

export default requireAdmin;
