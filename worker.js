// ============================================================
// LATTE PAWS — Backend (Cloudflare Worker)
// Automates: Stripe Checkout → Printful Order → Customer Delivery
//
// Deploy: https://workers.cloudflare.com (Free)
// Env vars needed:
//   PRINTFUL_API_KEY  (already known)
//   PRINTFUL_STORE_ID = 18807637
//   STRIPE_SECRET_KEY = sk_live_...
//   STRIPE_WEBHOOK_SECRET = whsec_...
//   SITE_URL = https://lattepaws.com
// ============================================================

const PRINTFUL_API_KEY = "oy42bJfc62iB1BRfW864F1lKqEAPjmNAIUw27dEf";
const PRINTFUL_STORE_ID = "18807637";

// Product catalog (mirrors the website)
const CATALOG = {
  100: {
    name: "Spooky Pups Halloween Bandana",
    type: "physical",
    price: 19.99,
    variants: {
      S: { syncVariantId: 5518213312, variantId: 16031 },
      M: { syncVariantId: 5518213314, variantId: 16032 },
      L: { syncVariantId: 5518213315, variantId: 16033 }
    }
  }
};

// ===== CORS =====
function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.SITE_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

// ===== PRINTFUL: Create Order =====
async function createPrintfulOrder(customer, items) {
  const orderData = {
    recipient: {
      name: customer.name,
      address1: customer.address,
      address2: customer.address2 || "",
      city: customer.city,
      state_code: customer.state,
      country_code: customer.country || "US",
      zip: customer.zip,
      email: customer.email,
      phone: customer.phone || ""
    },
    items: items.map(item => ({
      sync_variant_id: item.syncVariantId,
      quantity: item.quantity,
      retail_price: item.retailPrice.toFixed(2)
    })),
    retail_costs: {
      currency: "USD"
    },
    packing_slip: {
      email: customer.email,
      message: "Thanks for shopping at Latte Paws! 🐾 Tag us @lattepaws"
    }
  };

  const response = await fetch("https://api.printful.com/orders", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
      "X-PF-Store-Id": PRINTFUL_STORE_ID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(orderData)
  });

  return await response.json();
}

// ===== STRIPE: Create Checkout Session =====
async function createStripeCheckout(env, cart, origin) {
  const lineItems = cart.map(item => {
    const product = CATALOG[item.id];
    return {
      price_data: {
        currency: "usd",
        product_data: {
          name: product.name + (item.size ? ` (Size ${item.size})` : ""),
          description: product.type === "physical"
            ? "Ships from USA in 2-5 business days"
            : "Instant digital download"
        },
        unit_amount: Math.round(product.price * 100)
      },
      quantity: item.quantity
    };
  });

  // Add shipping for physical goods
  const hasPhysical = cart.some(item => CATALOG[item.id].type === "physical");

  const body = new URLSearchParams();
  body.append("mode", "payment");
  body.append("success_url", `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  body.append("cancel_url", `${origin}/#products`);
  body.append("shipping_address_collection[allowed_countries][0]", "US");
  if (hasPhysical) {
    body.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    body.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "499");
    body.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
    body.append("shipping_options[0][shipping_rate_data][display_name]", "US Standard Shipping (2-5 days)");
  }

  lineItems.forEach((item, i) => {
    body.append(`line_items[${i}][price_data][currency]`, item.price_data.currency);
    body.append(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
    body.append(`line_items[${i}][price_data][product_data][description]`, item.price_data.product_data.description);
    body.append(`line_items[${i}][price_data][unit_amount]`, item.price_data.unit_amount);
    body.append(`line_items[${i}][quantity]`, item.quantity);
  });

  // Store cart in metadata (Stripe metadata has size limits, so keep it compact)
  const metaCart = cart.map(i => `${i.id}:${i.size || "D"}:${i.quantity}`).join("|").substring(0, 490);
  body.append("metadata[cart]", metaCart);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  return await response.json();
}

// ===== ROUTER =====
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const headers = corsHeaders(env);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    // Health check
    if (path === "/api/health") {
      return new Response(JSON.stringify({ 
        status: "ok", 
        brand: "Latte Paws 🐾",
        store: PRINTFUL_STORE_ID
      }), { headers });
    }

    // Create Stripe checkout
    if (path === "/api/create-checkout" && request.method === "POST") {
      const { cart } = await request.json();
      const origin = url.origin;
      const session = await createStripeCheckout(env, cart, origin);

      if (session.error) {
        return new Response(JSON.stringify({ error: session.error.message }), { status: 400, headers });
      }
      return new Response(JSON.stringify({ url: session.url }), { headers });
    }

    // Stripe webhook → create Printful order
    if (path === "/api/stripe-webhook" && request.method === "POST") {
      const event = await request.json();

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // Parse cart from metadata
        const cartMeta = session.metadata?.cart || "";
        const cart = cartMeta.split("|").filter(Boolean).map(part => {
          const [id, size, qty] = part.split(":");
          return { id: parseInt(id), size: size === "D" ? null : size, quantity: parseInt(qty) };
        });

        // Build Printful items
        const printfulItems = [];
        for (const item of cart) {
          const product = CATALOG[item.id];
          if (!product) continue;
          if (product.type === "physical") {
            const variant = product.variants[item.size];
            printfulItems.push({
              syncVariantId: variant.syncVariantId,
              quantity: item.quantity,
              retailPrice: product.price
            });
          }
        }

        const customer = {
          name: session.shipping_details?.name || session.customer_details?.name || "Customer",
          email: session.customer_details?.email || "",
          address: session.shipping_details?.address?.line1 || "",
          address2: session.shipping_details?.address?.line2 || "",
          city: session.shipping_details?.address?.city || "",
          state: session.shipping_details?.address?.state || "",
          zip: session.shipping_details?.address?.postal_code || "",
          country: session.shipping_details?.address?.country || "US",
          phone: session.customer_details?.phone || ""
        };

        let printfulResult = null;
        if (printfulItems.length > 0) {
          printfulResult = await createPrintfulOrder(customer, printfulItems);
        }

        return new Response(JSON.stringify({ 
          received: true, 
          printful: printfulResult?.code === 200 ? "order_created" : printfulResult 
        }), { headers });
      }

      return new Response(JSON.stringify({ received: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};