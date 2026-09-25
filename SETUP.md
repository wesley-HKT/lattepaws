# 🚀 Latte Paws — Printful Integration Setup

你嘅 API Key 已驗證 ✅  
Bandana Product ID: 630  
Variant IDs: S=16031, M=16032, L=16033

---

## Step 1: Deploy Cloudflare Worker（免費）

### 1.1 開 Cloudflare Account（5 min）
```
1. 去 https://workers.cloudflare.com
2. Sign Up（免費）
3. Verify Email
```

### 1.2 Deploy Worker（5 min）
```
1. Cloudflare Dashboard → Workers & Pages
2. Create Worker
3. Copy & Paste worker.js 內容
4. Deploy
```

### 1.3 Set Environment Variables
```
在 Worker Settings → Environment Variables 加：

PRINTFUL_API_KEY = oy42bJfc62iB1BRfW864F1lKqEAPjmNAIUw27dEf
STRIPE_SECRET_KEY = sk_live_YOUR_KEY（等你有 Stripe）
SITE_URL = https://lattepaws.com
```

### 1.4 你嘅 API Endpoints
```
Worker URL: https://lattepaws-worker.xxxx.workers.dev
    ├── /api/health → Health check
    ├── /api/create-checkout → Create Stripe checkout
    └── /api/stripe-webhook → Receive Stripe payment
```

---

## Step 2: 上傳你嘅 Design 上 Printful

你需要在 Printful Dashboard 做：

### 2.1 開 Printful Store（免費）
```
1. 去 https://www.printful.com/dashboard
2. Go to Stores → Add Store
3. Choose "Sell on your own website"
```

### 2.2 建立 Bandana 產品
```
1. Printful Dashboard → Products → Add Product
2. Search "All-Over Print Bandana"
3. Upload 你嘅 Design 圖
4. 揀 S / M / L sizes
5. Set 你的零售價：$19.99
6. Save
```

### 2.3 拎 Sync Product ID
```
Product 建立後：
1. Products → 揀你個 Bandana
2. URL 會有 product_id
3. Copy 俾我 → 我 update worker.js
```

---

## Step 3: Connect Stripe

```
1. 去 https://dashboard.stripe.com
2. Enable Webhooks
3. Add Webhook Endpoint:
   URL: https://lattepaws-worker.xxxx.workers.dev/api/stripe-webhook
   Events: checkout.session.completed
4. Copy Secret Key → Update worker.js
```

---

## Step 4: Update lattepaws.com

我 update 個 Website 加入：
- ✅ Bandana 產品頁面
- ✅ "Buy Now" → Stripe Checkout
- ✅ Size guide
- ✅ Product descriptions
- ✅ Printful mockup images

---

## Quick Start（今晚做）

| Time | Task |
|------|------|
| 5 min | 開 Cloudflare Account |
| 5 min | Deploy Worker |
| 10 min | Upload 你嘅設計上 Printful |
| 5 min | Copy Sync Product ID 俾我 |
| 5 min | 我 update website |
| **30 min** | **✅ Done!** |