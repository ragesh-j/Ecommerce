# Ecommerce Backend API

A production-ready REST API for a full-stack ecommerce platform built with Node.js, Express, TypeScript, and PostgreSQL.

## Live Demo

- **API**: https://ecom-x1j4.onrender.com
- **Health Check**: https://ecom-x1j4.onrender.com/health

## Related Projects

- [Customer App](https://github.com/ragesh-j/Ecommerce-customer)
- [Admin Panel](https://github.com/ragesh-j/Ecommerce-admin)
- [Seller Dashboard](https://github.com/ragesh-j/Ecommerce-seller)

---

## Features

- 🔐 JWT authentication with access + refresh token rotation
- 🔑 Google OAuth 2.0 integration
- 👥 Role-based access control (BUYER, SELLER, ADMIN)
- 🛍️ Product management with variants and media uploads
- 🗂️ Category and tag system with subcategories
- 🛒 Backend-synced cart management
- 📦 Order management with status tracking
- 💳 Razorpay payment integration (payment-first flow)
- ⭐ Product reviews (verified purchase only)
- 🖼️ Cloudflare R2 media storage
- 🚦 Rate limiting on all routes
- 🛡️ Security headers with Helmet
- 📊 Banner management with image upload

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT + Passport.js |
| Payment | Razorpay |
| Storage | Cloudflare R2 |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Cloudflare R2 bucket
- Razorpay account (test or live)
- Google OAuth credentials

### Installation

```bash
git clone https://github.com/ragesh-j/Ecommerce.git
cd Ecommerce
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce

# JWT
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Cloudflare R2
CLOUDFLARE_R2_ACCESS_KEY=your_r2_access_key
CLOUDFLARE_R2_SECRET_KEY=your_r2_secret_key
CLOUDFLARE_R2_BUCKET=your_bucket_name
CLOUDFLARE_R2_ENDPOINT=your_r2_endpoint

# Frontend URLs (CORS)
FRONTEND_URL=http://localhost:5175
ADMIN_URL=http://localhost:5173
SELLER_URL=http://localhost:5174

# Environment
NODE_ENV=development
PORT=3000
```

### Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Seed admin user (admin@example.com / admin123)
npx prisma db seed
```

### Development

```bash
npm run dev
```

API runs at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

---

## API Routes

### Auth
```
POST   /api/v1/auth/register                        → Register as buyer
POST   /api/v1/auth/seller/register                 → Register as seller
POST   /api/v1/auth/login                           → Login
POST   /api/v1/auth/refresh                         → Refresh access token
POST   /api/v1/auth/logout                          → Logout
GET    /api/v1/auth/google                          → Initiate Google OAuth
GET    /api/v1/auth/google/callback                 → Google OAuth callback
POST   /api/v1/auth/oauth/exchange                  → Exchange OAuth code for token
```

### Users
```
GET    /api/v1/users/me                             → Get my profile
PUT    /api/v1/users/me                             → Update profile
PUT    /api/v1/users/me/password                    → Change password
POST   /api/v1/users/me/password                    → Set password (Google users)
GET    /api/v1/users/me/addresses                   → Get saved addresses
POST   /api/v1/users/me/addresses                   → Add address
PUT    /api/v1/users/me/addresses/:id               → Update address
DELETE /api/v1/users/me/addresses/:id               → Delete address
GET    /api/v1/users/me/orders                      → Get my orders
GET    /api/v1/users/me/reviews                     → Get my reviews
```

### Sellers
```
POST   /api/v1/sellers/profile                      → Create seller profile
GET    /api/v1/sellers/profile                      → Get my seller profile (SELLER)
PUT    /api/v1/sellers/profile                      → Update seller profile (SELLER)
GET    /api/v1/sellers/:id                          → Get public seller profile
```

### Categories
```
GET    /api/v1/categories                           → List all categories (public)
GET    /api/v1/categories/:slug                     → Get category by slug (public)
POST   /api/v1/categories                           → Create category (ADMIN)
PUT    /api/v1/categories/:id                       → Update category (ADMIN)
DELETE /api/v1/categories/:id                       → Delete category (ADMIN)
```

### Tags
```
GET    /api/v1/tags                                 → List all tags (public)
POST   /api/v1/tags                                 → Create tag (ADMIN)
PUT    /api/v1/tags/:id                             → Update tag (ADMIN)
DELETE /api/v1/tags/:id                             → Delete tag (ADMIN)
POST   /api/v1/tags/products/:productId/tags/:tagId → Assign tag to product (ADMIN)
DELETE /api/v1/tags/products/:productId/tags/:tagId → Remove tag from product (ADMIN)
```

### Products
```
GET    /api/v1/products                             → List products with filters (public)
GET    /api/v1/products/my                          → Seller's own products (SELLER)
GET    /api/v1/products/:slug                       → Get product by slug (public)
POST   /api/v1/products                             → Create product (SELLER)
PUT    /api/v1/products/:id                         → Update product (SELLER)
DELETE /api/v1/products/:id                         → Delete product (SELLER)
PATCH  /api/v1/products/:id/publish                 → Toggle publish (SELLER)
PATCH  /api/v1/products/:id/feature                 → Toggle featured (ADMIN)
```

### Product Variants
```
POST   /api/v1/products/:id/variants                → Add variant (SELLER)
PUT    /api/v1/products/:id/variants/:vid           → Update variant (SELLER)
DELETE /api/v1/products/:id/variants/:vid           → Delete variant (SELLER)
```

### Product Media
```
POST   /api/v1/products/:id/media                   → Upload images max 5 (SELLER)
DELETE /api/v1/products/:id/media/:mid              → Delete image (SELLER)
```

### Cart
```
GET    /api/v1/cart                                 → Get cart
POST   /api/v1/cart/items                           → Add item to cart
PUT    /api/v1/cart/items/:id                       → Update item quantity
DELETE /api/v1/cart/items/:id                       → Remove item
DELETE /api/v1/cart                                 → Clear cart
```

### Orders
```
GET    /api/v1/orders                               → Get my orders (BUYER)
GET    /api/v1/orders/:id                           → Get order by id
PATCH  /api/v1/orders/:id/cancel                    → Cancel order (BUYER)
GET    /api/v1/orders/seller/list                   → Get seller orders (SELLER)
PATCH  /api/v1/orders/:id/status                    → Update order status (SELLER)
```

### Payments
```
POST   /api/v1/payments/initiate                    → Initiate Razorpay order
POST   /api/v1/payments/verify                      → Verify payment + create order
POST   /api/v1/payments/webhook                     → Razorpay webhook (safety net)
GET    /api/v1/payments/:orderId                    → Get payment by order id
```

### Reviews
```
GET    /api/v1/reviews/products/:productId          → Get product reviews (public)
POST   /api/v1/reviews/products/:productId          → Create review (verified purchase only)
PUT    /api/v1/reviews/:id                          → Update review
DELETE /api/v1/reviews/:id                          → Delete review
```

### Banners
```
GET    /api/v1/banners                              → Get active banners (public)
GET    /api/v1/banners/all                          → Get all banners (ADMIN)
POST   /api/v1/banners                              → Create banner (ADMIN)
PUT    /api/v1/banners/:id                          → Update banner (ADMIN)
POST   /api/v1/banners/:id/image                    → Upload banner image (ADMIN)
PATCH  /api/v1/banners/:id/toggle                   → Toggle active (ADMIN)
DELETE /api/v1/banners/:id                          → Delete banner (ADMIN)
```

---

## Payment Flow

The app uses a **payment-first** approach — no order is created in the database until payment is confirmed.

```
1. POST /payments/initiate
   → Validates cart, address, stock availability
   → Creates Razorpay order only (no DB order yet)
   → Returns razorpayOrderId to frontend

2. User completes payment in Razorpay popup

3. POST /payments/verify
   → Verifies Razorpay HMAC signature
   → Creates DB order (status: PAID)
   → Creates payment record (status: COMPLETED)
   → Deducts stock for each variant
   → Increments product salesCount
   → Clears cart
   → All in a single Prisma transaction ✅

4. POST /payments/webhook (safety net)
   → Handles edge cases where verify didn't fire
   → Checks if payment already processed before acting
   → Prevents duplicate orders
```

**Benefits:**
- No PENDING or FAILED orders in the database
- Stock only deducted after confirmed payment
- Cart only cleared after confirmed payment
- Dismissed payments leave zero DB trace

---

## Authentication Flow

```
Email/Password:
  POST /auth/login → access token (15min) + refresh token cookie (7 days)
  POST /auth/refresh → new access token using cookie
  POST /auth/logout → clears cookie

Google OAuth:
  GET /auth/google → redirects to Google
  GET /auth/google/callback → sets refresh cookie → redirects to frontend with session code
  POST /auth/oauth/exchange → exchanges code for access token
```

- Access token stored in memory on the frontend (not localStorage)
- Refresh token stored in `httpOnly`, `secure`, `sameSite: none` cookie
- Cross-origin cookie works between Vercel frontend and Render backend

---

## Security

- **Helmet** — sets secure HTTP response headers
- **CORS** — restricted to allowed frontend origins only
- **Rate limiting** — general limiter on all routes, stricter limiter on auth routes
- **JWT** — short-lived access tokens (15 min), long-lived refresh tokens (7 days)
- **httpOnly cookies** — refresh tokens inaccessible to JavaScript
- **Razorpay signature verification** — HMAC validation before any order creation
- **Role-based authorization** — BUYER, SELLER, ADMIN guards on all protected routes
- **Zod validation** — all request bodies validated before reaching service layer
- **Ownership checks** — sellers can only modify their own products and orders

---

## Order Status Flow

```
PAID → SHIPPED → DELIVERED
PAID → CANCELLED (buyer or seller)
SHIPPED → DELIVERED (seller only)
```

---

## Project Structure

```
src/
├── config/
│   ├── db.ts               # Prisma client
│   ├── razorpay.ts         # Razorpay client
│   └── rateLimiter.ts      # Rate limit config
├── middlewares/
│   ├── authenticate.ts     # JWT verification
│   ├── authorize.ts        # Role-based access
│   ├── errorHandler.ts     # Global error handler
│   └── notFound.ts         # 404 handler
├── modules/
│   ├── auth/               # Login, register, Google OAuth
│   ├── user/               # Profile, addresses, orders, reviews
│   ├── seller/             # Seller profile management
│   ├── product/            # Products, variants, media
│   ├── category/           # Category management
│   ├── tag/                # Tag management
│   ├── cart/               # Cart operations
│   ├── order/              # Order management
│   ├── payment/            # Razorpay integration
│   ├── review/             # Product reviews
│   └── banner/             # Banner management
├── types/
│   └── express.d.ts        # Express type extensions
└── utils/
    ├── ApiError.ts         # Custom error class
    ├── catchAsync.ts       # Async error wrapper
    ├── upload.ts           # Multer + R2 upload
    ├── hash.ts             # bcrypt helpers
    └── token.ts            # JWT helpers
```

---

## Deployment

### Render (Production)

**Build Command:**
```
npm install && npx prisma generate && npm run build && npx prisma migrate deploy
```

**Start Command:**
```
npm start
```

**Required Environment Variables:** All variables listed above with production values.

---

## Default Admin Credentials

After running `npx prisma db seed`:

```
Email: admin@example.com
Password: admin123
```

> Change the password after first login in production.
