// Latte Paws Backend — Cloudflare Worker
// Handles: Stripe Checkout, Printful Order Creation
// Deploy to: https://workers.cloudflare.com (Free Tier)

// ===== CONFIGURATION =====
const CONFIG = {
  printfulApiKey: "oy42bJfc62iB1BRfW864F1lKqEAPjmNAIUw27dEf",
  stripeSecretKey: "sk_live_YOUR_STRIPE_SECRET_KEY",  // ← UPDATE THIS
  siteUrl: "https://lattepaws.com",
  siteName: "Latte Paws"
};

// ===== PRINTFUL API HELPER =====
async function printfulApi(endpoint, method = "GET", body = null) {
  const url = `https://api.printful.com${endpoint}`;
  const headers = {
    "Authorization": `Bearer ${CONFIG.printfulApiKey}`,
    "Content-Type": "application/json"
  };
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  
  return await response.json();
}

// ===== CREATE PRINTFUL ORDER =====
async function createPrintfulOrder(customer, items) {
  const orderData = {
    recipient: {
      name: customer.name,
      address1: customer.address,
      city: customer.city,
      state_code: customer.state,
      country_code: "US",
      zip: customer.zip,
      email: customer.email
    },
    items: items.map(item => ({
      sync_product_id: item.syncProductId,
      sync_variant_id: item.syncVariantId,
      quantity: item.quantity,
      retail_price: item.price.toFixed(2)
    })),
    packing_slip: {
      email: customer.email,
      message: "Thanks for shopping at Latte Paws! 🐾"
    }
  };
  
  return await printfulApi("/orders", "POST", orderData);
}

// ===== STRIPE WEBHOOK HANDLER =====
async function handleStripeWebhook(event) {
  const payload = await event.request.json();
  
  if (payload.type === "checkout.session.completed") {
    const session = payload.data.object;
    
    // Extract customer + order details from Stripe session
    const customer = {
      name: session.shipping_details?.name || session.customer_details?.name || "Customer",
      email: session.customer_details?.email || "",
      address: session.shipping_details?.address?.line1 || "",
      city: session.shipping_details?.address?.city || "",
      state: session.shipping_details?.address?.state || "",
      zip: session.shipping_details?.address?.postal_code || ""
    };
    
    // In production: parse metadata for product IDs
    // For now, create a test order
    const order = await createPrintfulOrder(customer, [
      {
        syncProductId: null,   // ← Need to create product in Printful first
        syncVariantId: null,   // ← Need to get variant ID
        quantity: 1,
        price: 14.99
      }
    ]);
    
    return new Response(JSON.stringify({ received: true, order }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  });
}

// ===== CREATE STRIPE CHECKOUT SESSION =====
async function createCheckoutSession(product) {
  // This would normally use Stripe SDK
  // For now, we redirect to Stripe Payment Link
  return {
    url: "https://buy.stripe.com/YOUR_PAYMENT_LINK"  // ← UPDATE THIS
  };
}

// ===== ROUTER =====
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": CONFIG.siteUrl,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  
  // Handle OPTIONS (preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Routes
    if (path === "/api/create-checkout" && request.method === "POST") {
      const body = await request.json();
      const result = await createCheckoutSession(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    if (path === "/api/stripe-webhook" && request.method === "POST") {
      return await handleStripeWebhook(request);
    }
    
    if (path === "/api/health") {
      return new Response(JSON.stringify({ status: "ok", brand: "Latte Paws 🐾" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // 404
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Cloudflare Worker entry point
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});