import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED =
  /(^|\.)(realtor\.com|zillow\.com|trulia\.com|redfin\.com)$/i;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function isBlocked(html: string): boolean {
  const head = html.slice(0, 4000).toLowerCase();
  return (
    head.includes("px-captcha") ||
    head.includes("access to this page has been denied") ||
    head.includes("cf-challenge") ||
    (html.length < 8000 && head.includes("captcha"))
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "POST required" }, 405);
  }

  let url = "";
  try {
    const body = await req.json();
    url = String(body?.url ?? "").trim();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!url) return json({ ok: false, error: "url is required" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ ok: false, error: "Invalid URL" }, 400);
  }

  if (!ALLOWED.test(parsed.hostname)) {
    return json(
      { ok: false, error: "Host not allowed" },
      400,
    );
  }

  // Drop tracking noise
  parsed.hash = "";
  const cleanUrl = parsed.toString();

  try {
    const res = await fetch(cleanUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    const html = await res.text();
    if (!res.ok) {
      return json({
        ok: false,
        url: cleanUrl,
        blocked: isBlocked(html),
        error: `Listing site returned HTTP ${res.status}`,
        status: res.status,
      });
    }

    if (isBlocked(html)) {
      return json({
        ok: false,
        url: cleanUrl,
        blocked: true,
        error: "Listing site blocked the request",
        html: "",
      });
    }

    // Cap payload size for the client (~1.5MB)
    const capped = html.length > 1_500_000
      ? html.slice(0, 1_500_000)
      : html;

    return json({
      ok: true,
      url: cleanUrl,
      blocked: false,
      html: capped,
    });
  } catch (e) {
    return json({
      ok: false,
      url: cleanUrl,
      blocked: false,
      error: e instanceof Error ? e.message : "Fetch failed",
    }, 502);
  }
});
