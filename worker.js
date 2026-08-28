export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/create-checkout" && request.method === "POST") {
      try {
        const body = await request.json();
        const cart = body.cart;

        if (!Array.isArray(cart) || cart.length === 0) {
          return new Response(
            JSON.stringify({ error: "Cart is empty or invalid" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        const lineItems = cart.map(item => ({
          quantity: String(item.qty),
          catalog_object_id: item.id
        }));

        const squareResponse = await fetch(
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
                line_items: lineItems
              }
            })
          }
        );

        const data = await squareResponse.json();

        if (!squareResponse.ok) {
          return new Response(JSON.stringify(data), {
            status: squareResponse.status,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(
          JSON.stringify({
            checkoutUrl: data.payment_link?.url
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};