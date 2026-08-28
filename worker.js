// Square checkout endpoint - production
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Square checkout endpoint
    if (url.pathname === "/create-checkout" && request.method === "POST") {
      return handleCreateCheckout(request, env);
    }

    // Serve your normal website
    return env.ASSETS.fetch(request);
  }
};

async function handleCreateCheckout(request, env) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.cart) || body.cart.length === 0) {
      return new Response(
        JSON.stringify({ error: "Cart is empty." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const line_items = body.cart.map(item => ({
      catalog_object_id: item.id,
      quantity: String(item.qty)
    }));

    const response = await fetch(
      "https://connect.squareup.com/v2/online-checkout/payment-links",
      {
        method: "POST",
        headers: {
          "Square-Version": "2026-08-19",
          "Authorization": `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          order: {
            location_id: env.SQUARE_LOCATION_ID,
            line_items
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Square error:", data);

      return new Response(
        JSON.stringify({
          error: "Square checkout failed.",
          details: data
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        checkoutUrl: data.payment_link?.url
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (error) {
    console.error("Checkout error:", error);

    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}