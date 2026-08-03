// Vercel serverless function: extract structured cost data from a receipt photo
// using Claude vision. Requires env var ANTHROPIC_API_KEY (set in Vercel).
// Optional: ANTHROPIC_MODEL (defaults to claude-opus-5; set claude-haiku-4-5 for lower cost).

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured in Vercel." });
    return;
  }

  try {
    var body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    var image = body && body.image;
    var categories = (body && body.categories) || [];
    if (!image || image.indexOf("data:") !== 0) {
      res.status(400).json({ error: "A base64 image data URL is required." });
      return;
    }
    // data:image/jpeg;base64,XXXX
    var comma = image.indexOf(",");
    var meta = image.slice(5, comma); // image/jpeg;base64
    var mediaType = meta.split(";")[0] || "image/jpeg";
    var data = image.slice(comma + 1);

    var schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        txn_date: { type: "string", description: "Date on the receipt as YYYY-MM-DD, or empty string if none." },
        vendor: { type: "string", description: "Shop/vendor/person name, or empty." },
        currency: { type: "string", description: "Currency code, default BDT." },
        total: { type: "number", description: "Grand total amount as a number." },
        items: {
          type: "array",
          description: "Line items on the receipt.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              description: { type: "string" },
              category: { type: "string", description: "Best-matching category from the provided list, or a sensible new one." },
              amount: { type: "number" }
            },
            required: ["description", "category", "amount"]
          }
        }
      },
      required: ["txn_date", "vendor", "currency", "total", "items"]
    };

    var catText = categories.length
      ? "Map each item to the closest of these existing categories when reasonable (else pick a sensible short category name):\n" + categories.join(", ")
      : "Choose a sensible short category name for each item.";

    var payload = {
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema", schema: schema } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: data } },
            {
              type: "text",
              text:
                "This is a photo of a construction-cost receipt/slip (often in Bengali). " +
                "Extract every line item with its amount, the grand total, the date, and vendor. " +
                "Amounts are numbers only (no currency symbols). Default currency is BDT. " +
                catText
            }
          ]
        }
      ]
    };

    var apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });

    var out = await apiRes.json();
    if (!apiRes.ok) {
      res.status(apiRes.status).json({ error: (out && out.error && out.error.message) || "Claude API error" });
      return;
    }
    if (out.stop_reason === "refusal") {
      res.status(422).json({ error: "The image could not be processed (refusal)." });
      return;
    }
    var textBlock = (out.content || []).filter(function (b) { return b.type === "text"; })[0];
    if (!textBlock) { res.status(502).json({ error: "No content returned." }); return; }
    var parsed;
    try { parsed = JSON.parse(textBlock.text); }
    catch (e) { res.status(502).json({ error: "Could not parse extraction result." }); return; }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
