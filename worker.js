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
            line_items: body.line_items
          }
        })
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}