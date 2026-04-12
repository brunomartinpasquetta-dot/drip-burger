import { Router } from 'express';
import healthCheck from './health-check.js';
import ordersRouter from './orders.js';
import productsRouter from './products.js';

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.use('/orders', ordersRouter);
    router.use('/products', productsRouter);

    return router;
};
