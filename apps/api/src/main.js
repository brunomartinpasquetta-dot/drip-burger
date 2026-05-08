import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';
import { initWhatsApp, destroyWhatsApp } from './services/whatsappService.js';

const app = express();

app.set('trust proxy', true);

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

const gracefulShutdown = async (signal) => {
	logger.info(`${signal} signal received — cerrando WhatsApp client...`);
	await destroyWhatsApp();
	logger.info('Exiting');
	process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

app.use(helmet());

// CORS — siempre permitimos apex + www + localhost. Cualquier origen extra
// definido en CORS_ORIGIN (lista CSV) se suma a esos defaults. Ningún env
// var puede dejar a www o apex sin acceso, porque el frontend de prod
// puede servirse en cualquiera de las 2 variantes y los usuarios entran
// indistintamente.
const DEFAULT_ALLOWED = [
	'https://dripburger.shop',
	'https://www.dripburger.shop',
	'http://localhost:3001',
	'http://localhost:5173',
];
const extraAllowed = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
	: [];
const allowedOrigins = Array.from(new Set([...DEFAULT_ALLOWED, ...extraAllowed]));
logger.info(`[cors] orígenes permitidos: ${allowedOrigins.join(', ')}`);
app.use(cors({
	origin: (origin, cb) => {
		// origin === undefined cuando es same-origin / curl / health-checks
		if (!origin) return cb(null, true);
		if (allowedOrigins.includes(origin)) return cb(null, true);
		// En vez de tirar Error (que rompe el preflight con 500), respondemos
		// false: el browser muestra error CORS limpio y los handlers downstream
		// pueden decidir 403/200 según convenga.
		logger.warn(`[cors] origin bloqueado: ${origin}`);
		return cb(null, false);
	},
	credentials: true,
}));
app.use(morgan('combined'));
app.use(globalRateLimit);
app.use(express.json({
	limit: BodyLimit,
}));
app.use(express.urlencoded({ 
	extended: true,
	limit: BodyLimit,
}));

app.use('/', routes());

app.use(errorMiddleware);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
	logger.info(`🚀 API Server running on http://localhost:${port}`);
	// WhatsApp se inicializa en background — no bloqueamos el startup del API.
	// El primer arranque requiere escanear QR impreso en stdout; después la
	// sesión persiste en ./wa-session/ y reinicios no piden QR de nuevo.
	initWhatsApp();
});

export default app;
