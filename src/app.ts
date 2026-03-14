import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import passport from 'passport';

import errorHandler from './middlewares/errorHandler';
import notFound from './middlewares/notFound';
import './modules/auth/google.strategy'; // ← registers the strategy

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Passport ─────────────────────────────────────────────────────────────────
app.use(passport.initialize()); // ← add this

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users',userRoutes);
// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;