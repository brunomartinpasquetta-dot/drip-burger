import { Router } from 'express';
import healthCheck from './health-check.js';
import ordersRouter from './orders.js';
import productsRouter from './products.js';
import integrationsRouter from './integrations.js';
import slotsRouter from './slots.js';
import paymentsRouter from './payments.js';

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.use('/orders', ordersRouter);
    router.use('/products', productsRouter);
    router.use('/integrations', integrationsRouter);
    router.use('/slots', slotsRouter);
    router.use('/payments', paymentsRouter);

    return router;
};
