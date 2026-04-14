import { Router } from 'express';
import healthCheck from './health-check.js';
import ordersRouter from './orders.js';
import productsRouter from './products.js';
import integrationsRouter from './integrations.js';

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.use('/orders', ordersRouter);
    router.use('/products', productsRouter);
    router.use('/integrations', integrationsRouter);

    return router;
};
