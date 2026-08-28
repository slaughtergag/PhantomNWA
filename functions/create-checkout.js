/**
 * functions/create-checkout.js
 * -----------------------------------------------------------------
 * Cloudflare Pages Functions convention: this file's path IS the route.
 * Since it lives at functions/create-checkout.js, Cloudflare automatically
 * serves it at POST /create-checkout — cart.js needs zero changes.
 *
 * SETUP:
 *   1. Put this file at:  your-repo/functions/create-checkout.js
 *      (a top-level "functions" folder, sibling to index.html)
 *   2. Push to GitHub.
 *   3. Go to pages.cloudflare.com → Create a project → Connect to Git →
 *      pick this repo. Leave build settings blank (no build step needed
 *      for a plain static site) and deploy.
 *   4. In the Cloudflare Pages project → Settings → Environment variables,
 *      add (for both "Production" and "Preview"):
 *        SQUARE_ACCESS_TOKEN
 *        SQUARE_LOCATION_ID
 *        SQUARE_ENV          ("sandbox" or "production")
 *      Redeploy after saving — env vars only apply to new deploys.
 *
 * That's it — no netlify.toml-style redirect file, no separate server,
 * no VPS. Cloudflare's free tier: 100,000 requests/day for Functions,
 * unlimited static bandwidth.
 *
 * Docs: https://developer.squareup.com/reference/square/checkout-api/create-payment-link
 */

const SQUARE_BASE_URL = {
  sandbox: "https://connect.squareupsandbox.com",
  production: "https://connect.squareup.com",
};

const MAX_QTY_PER_LINE = 20;

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const cart = body.cart;

    if (!Array.isArray(cart) || cart.length === 0) {
      return jsonResponse({ error: "Cart is empty or invalid" }, 400);
    }

    // Validate shape only — Square resolves the real price itself from
    // the catalog id, so nothing here trusts a price sent by the browser.
    const lineItems = [];
    for (const line of cart) {
      if (typeof line.id !== "string" || line.id.length === 0) {
        return jsonResponse({ error: "Missing catalog id on a cart line" }, 400);
      }

      const qty = Number.isInteger(line.qty) ? line.qty : parseInt(line.qty, 10);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
        return jsonResponse({ error: `Invalid quantity for ${line.id}` }, 400);
      }

      lineItems.push({
        catalog_object_id: line.id,
        quantity: String(qty),
      });
    }

    const squareEnv = env.SQUARE_ENV === "production" ? "production" : "sandbox";
    const baseUrl = SQUARE_BASE_URL[squareEnv];
    const siteUrl = new URL(request.url).origin;

    const squareRes = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        "Square-Version": "2026-08-19",
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        order: {
          location_id: env.SQUARE_LOCATION_ID,
          line_items: lineItems,
        },
        checkout_options: {
          redirect_url: `${siteUrl}/thank-you.html`,
        },
      }),
    });

    const data = await squareRes.json();

    if (!squareRes.ok) {
      console.error("Square API error:", data);
      return jsonResponse({ error: "Square API error", details: data }, 502);
    }

    return jsonResponse({
      checkoutUrl: data.payment_link.url,
      orderId: data.payment_link.order_id,
    });
  } catch (err) {
    console.error("create-checkout error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}