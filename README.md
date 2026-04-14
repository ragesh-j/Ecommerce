# Ecommerce Backend API

A production-ready REST API for a full-stack ecommerce platform built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- 🔐 JWT authentication with access + refresh token rotation
- 🔑 Google OAuth 2.0 integration
- 👥 Role-based access control (BUYER, SELLER, ADMIN)
- 🛍️ Product management with variants and media
- 🗂️ Category and tag system
- 🛒 Cart management
- 📦 Order management with status tracking
- 💳 Razorpay payment integration (payment-first flow)
- ⭐ Product reviews (verified purchase only)
- 🖼️ Cloudflare R2 media storage
- 🚦 Rate limiting and security headers
- 📊 Banner management

## Tech Stack

- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** — database
- **Prisma ORM** — database client
- **Razorpay** — payment gateway
- **Cloudflare R2** — media storage
- **Passport.js** — Google OAuth
- **Zod** — request validation
- **Helmet** + **CORS** + **Rate limiting** — security

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Cloudflare R2 bucket
- Razorpay account
- Google OAuth credentials

### Installation

```bash
git clone https://github.com/ragesh-j/Ecommerce.git
cd Ecommerce
npm install
```

### Environment Variables

Create a `.env` file:

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

# Frontend URLs
FRONTEND_URL=http://localhost:5175
ADMIN_URL=http://localhost:5173
SELLER_URL=http://localhost:5174

# Node
NODE_ENV=development
```

### Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Seed admin user
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

## API Routes

### Auth
```
POST   /api/v1/auth/register                → Register as buyer
POST   /api/v1/auth/seller/register         → Register as seller
POST   /api/v1/auth/login                   → Login
POST   /api/v1/auth/refresh                 → Refresh access token
POST   /api/v1/auth/logout                  → Logout
GET    /api/v1/auth/google                  → Google OAuth
GET    /api/v1/auth/google/callback         → Google OAuth callback
POST   /api/v1/auth/oauth/exchange          → Exchange OAuth code for token
```

### Users
```
GET    /api/v1/users/me                     → Get profile
PUT    /api/v1/users/me                     → Update profile
PUT    /api/v1/users/me/password            → Change password
POST   /api/v1/users/me/password            → Set password (Google users)
GET    /api/v1/users/me/addresses           → Get addresses
POST   /api/v1/users/me/addresses           → Add address
PUT    /api/v1/users/me/addresses/:id       → Update address
DELETE /api/v1/users/me/addresses/:id       → Delete address
GET    /api/v1/users/me/orders              → Get my orders
GET    /api/v1/users/me/reviews             → Get my reviews
```

### Sellers
```
POST   /api/v1/sellers/profile              → Create seller profile
GET    /api/v1/sellers/profile              → Get my seller profile (SELLER)
PUT    /api/v1/sellers/profile              → Update seller profile (SELLER)
GET    /api/v1/sellers/:id                  → Get public seller profile
```

### Categories
```
GET    /api/v1/categories                   → List all categories (public)
GET    /api/v1/categories/:slug             → Get category by slug (public)
POST   /api/v1/categories                   → Create category (ADMIN)
PUT    /api/v1/categories/:id               → Update category (ADMIN)
DELETE /api/v1/categories/:id               → Delete category (ADMIN)
```

### Tags
```
GET    /api/v1/tags                                         → List all tags (public)
POST   /api/v1/tags                                         → Create tag (ADMIN)
PUT    /api/v1/tags/:id                                     → Update tag (ADMIN)
DELETE /api/v1/tags/:id                                     → Delete tag (ADMIN)
POST   /api/v1/tags/products/:productId/tags/:tagId         → Assign tag to product (ADMIN)
DELETE /api/v1/tags/products/:productId/tags/:tagId         → Remove tag from product (ADMIN)
```

### Products
```
GET    /api/v1/products                     → List products (public)
GET    /api/v1/products/my                  → Seller's own products (SELLER)
GET    /api/v1/products/:slug               → Get product by slug (public)
POST   /api/v1/products                     → Create product (SELLER)
PUT    /api/v1/products/:id                 → Update product (SELLER)
DELETE /api/v1/products/:id                 → Delete product (SELLER)
PATCH  /api/v1/products/:id/publish         → Toggle publish (SELLER)
PATCH  /api/v1/products/:id/feature         → Toggle featured (ADMIN)
```

### Product Variants
```
POST   /api/v1/products/:id/variants        → Add variant (SELLER)
PUT    /api/v1/products/:id/variants/:vid   → Update variant (SELLER)
DELETE /api/v1/products/:id/variants/:vid   → Delete variant (SELLER)
```

### Product Media
```
POST   /api/v1/products/:id/media           → Upload images (SELLER)
DELETE /api/v1/products/:id/media/:mid      → Delete image (SELLER)
```

### Cart
```
GET    /api/v1/cart                         → Get cart
POST   /api/v1/cart/items                   → Add item to cart
PUT    /api/v1/cart/items/:id               → Update item quantity
DELETE /api/v1/cart/items/:id               → Remove item from cart
DELETE /api/v1/cart                         → Clear cart
```

### Orders
```
GET    /api/v1/orders                       → Get my orders (BUYER)
GET    /api/v1/orders/:id                   → Get order by id
PATCH  /api/v1/orders/:id/cancel            → Cancel order (BUYER)
GET    /api/v1/orders/seller/list           → Seller orders (SELLER)
PATCH  /api/v1/orders/:id/status            → Update order status (SELLER)
```

### Payments
```
POST   /api/v1/payments/initiate            → Initiate Razorpay payment
POST   /api/v1/payments/verify              → Verify payment + create order
POST   /api/v1/payments/webhook             → Razorpay webhook (safety net)
GET    /api/v1/payments/:orderId            → Get payment by order id
```

### Reviews
```
GET    /api/v1/reviews/products/:productId  → Get product reviews (public)
POST   /api/v1/reviews/products/:productId  → Create review (verified purchase)
PUT    /api/v1/reviews/:id                  → Update review
DELETE /api/v1/reviews/:id                  → Delete review
```

### Banners
```
GET    /api/v1/banners                      → Active banners (public)
GET    /api/v1/banners/all                  → All banners (ADMIN)
POST   /api/v1/banners                      → Create banner (ADMIN)
PUT    /api/v1/banners/:id                  → Update banner (ADMIN)
POST   /api/v1/banners/:id/image            → Upload banner image (ADMIN)
PATCH  /api/v1/banners/:id/toggle           → Toggle active (ADMIN)
DELETE /api/v1/banners/:id                  → Delete banner (ADMIN)
```

## Payment Flow

```
1. POST /payments/initiate
   → Validates cart, address, stock
   → Creates Razorpay order only (no DB order)
   → Returns razorpayOrderId

2. User pays in Razorpay popup

3. POST /payments/verify
   → Verifies Razorpay signature
   → Creates order in DB (status: PAID)
   → Creates payment record (status: COMPLETED)
   → Deducts stock
   → Clears cart
   → All in one transaction ✅

4. Webhook (safety net)
   → Handles edge cases where verify didn't fire (network issues)
   → Checks if order already created before creating again
```

## Project Structure

```
src/
├── config/           # DB, Razorpay, rate limiter
├── middlewares/      # Auth, error handler, not found
├── modules/
│   ├── auth/         # Login, register, OAuth
│   ├── user/         # Profile, addresses, reviews
│   ├── seller/       # Seller profile
│   ├── product/      # Products, variants, media
│   ├── category/     # Categories
│   ├── tag/          # Tags
│   ├── cart/         # Cart management
│   ├── order/        # Order management
│   ├── payment/      # Razorpay integration
│   ├── review/       # Product reviews
│   └── banner/       # Banners
├── types/            # TypeScript type extensions
└── utils/            # ApiError, catchAsync, upload
```

## Deployment

Deployed on **Render** with **PostgreSQL** database.

- API: https://ecom-x1j4.onrender.com
- Health check: https://ecom-x1j4.onrender.com/health

## Related Projects

- [Customer App](https://github.com/ragesh-j/Ecommerce-customer)
- [Admin Panel](https://github.com/ragesh-j/Ecommerce-admin)
- [Seller Dashboard](https://github.com/ragesh-j/Ecommerce-seller)
