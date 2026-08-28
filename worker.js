export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ─────────────────────────────────────────────────────────────
    // CORS
    // ─────────────────────────────────────────────────────────────

    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://phantomnwa.shop",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // ─────────────────────────────────────────────────────────────
    // GET /inventory
    //
    // Example:
    // /inventory?ids=ID1,ID2,ID3
    //
    // Returns the current Square inventory for those variations.
    // ─────────────────────────────────────────────────────────────

    if (url.pathname === "/inventory" && request.method === "GET") {
      try {
        const idsParam = url.searchParams.get("ids");

        if (!idsParam) {
          return new Response(
            JSON.stringify({
              error: "Missing ids parameter"
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        const catalogObjectIds = idsParam
          .split(",")
          .map(id => id.trim())
          .filter(Boolean);

        if (catalogObjectIds.length === 0) {
          return new Response(
            JSON.stringify({
              error: "No catalog IDs provided"
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        if (catalogObjectIds.length > 1000) {
          return new Response(
            JSON.stringify({
              error: "Maximum of 1000 catalog IDs per request"
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        const squareResponse = await fetch(
          "https://connect.squareup.com/v2/inventory/counts/batch-retrieve",
          {
            method: "POST",
            headers: {
              "Square-Version": "2026-08-19",
              "Authorization": `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              catalog_object_ids: catalogObjectIds,
              location_ids: [env.SQUARE_LOCATION_ID],
              states: ["IN_STOCK"]
            })
          }
        );

        const data = await squareResponse.json();

        if (!squareResponse.ok) {
          return new Response(
            JSON.stringify(data),
            {
              status: squareResponse.status,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        // Convert Square's response into something easier
        // for your frontend to use.
        const inventory = {};

        for (const count of data.counts || []) {
          inventory[count.catalog_object_id] = {
            quantity: Number(count.quantity),
            state: count.state,
            locationId: count.location_id,
            calculatedAt: count.calculated_at
          };
        }

        // IDs with no returned count are treated as zero.
        for (const id of catalogObjectIds) {
          if (!inventory[id]) {
            inventory[id] = {
              quantity: 0,
              state: "OUT_OF_STOCK"
            };
          }
        }

        return new Response(
          JSON.stringify({
            inventory
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
              "Cache-Control": "no-store"
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    }

    // ─────────────────────────────────────────────────────────────
    // POST /create-checkout
    // ─────────────────────────────────────────────────────────────

    if (url.pathname === "/create-checkout" && request.method === "POST") {
      try {
        const body = await request.json();
        const cart = body.cart;

        if (!Array.isArray(cart) || cart.length === 0) {
          return new Response(
            JSON.stringify({
              error: "Cart is empty or invalid"
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
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
          return new Response(
            JSON.stringify(data),
            {
              status: squareResponse.status,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
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
              ...corsHeaders
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    }

    return new Response(
      "Not Found",
      {
        status: 404,
        headers: corsHeaders
      }
    );
  }
};