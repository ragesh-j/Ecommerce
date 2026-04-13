import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import compression from 'compression';

import errorHandler from './middlewares/errorHandler';
import notFound from './middlewares/notFound';
import './modules/auth/google.strategy';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import sellerRoutes from './modules/seller/seller.routes';
import categoryRoutes from './modules/category/category.routes';
import productRoutes from './modules/product/product.routes';
import cartRoutes from './modules/cart/cart.routes';
import orderRoutes from './modules/order/order.routes';
import paymentRoutes from './modules/payment/payment.routes';
import reviewRoutes from './modules/review/review.routes';
import bannerRoutes from './modules/banner/banner.routes'
import tagRoutes from "./modules/tag/tag.routes";
import { generalLimiter, authLimiter } from './config/rateLimiter';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression()); 
app.set('trust proxy', 1);
app.use(cors({
    origin: [
    process.env.FRONTEND_URL!,        // customer app
    process.env.ADMIN_URL!,           // admin app
    process.env.SELLER_URL!,          // seller app
  ],
  credentials: true,
}));

app.use(generalLimiter); // ← apply to all routes

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ─── Payment routes BEFORE express.json (webhook needs raw body) ──────────────
app.use('/api/v1/payments', paymentRoutes);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Passport ─────────────────────────────────────────────────────────────────
app.use(passport.initialize());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/sellers', sellerRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/banners', bannerRoutes);
app.use('/api/v1/tags', tagRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;