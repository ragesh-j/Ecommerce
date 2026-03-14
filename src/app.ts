import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import errorHandler from './middlewares/errorHandler';
import notFound from './middlewares/notFound';

// routes (uncomment as you build each module)
import authRoutes from './modules/auth/auth.routes';
// import userRoutes from './modules/user/user.routes';
// import productRoutes from './modules/product/product.routes';
// import orderRoutes from './modules/order/order.routes';
// import paymentRoutes from './modules/payment/payment.routes';
// import sellerRoutes from './modules/seller/seller.routes';
// import mediaRoutes from './modules/media/media.routes';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true, // allow cookies → needed for refreshToken
}));

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // parse cookies → needed for refreshToken

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/users', userRoutes);
// app.use('/api/v1/products', productRoutes);
// app.use('/api/v1/orders', orderRoutes);
// app.use('/api/v1/payments', paymentRoutes);
// app.use('/api/v1/sellers', sellerRoutes);
// app.use('/api/v1/media', mediaRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);      // 404 → must be after all routes
app.use(errorHandler);  // global error handler → must be last

export default app;