import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/** Fallback: 16401 Miramar Pkwy, Miramar, FL 33027 */
const DEFAULT_ANCHOR = { lat: 25.9766916, lon: -80.3324567 };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOMINATIM_UA = "RoomForNextChapter/0.1 (commute-time edge function)";

type RouteResult = {
  minutes: number | null;
  distanceMiles?: number | null;
  error?: string;
};

type AnchorInput = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatAnchorLine(anchor?: AnchorInput): string | null {
  if (!anchor) return null;
  const street = String(anchor.street ?? "").trim();
  const city = String(anchor.city ?? "").trim();
  const state = String(anchor.state ?? "").trim().toUpperCase();
  const zip = String(anchor.zip ?? "").trim();
  if (!city || !state) return null;
  const parts = [street, `${city}, ${state}${zip ? ` ${zip}` : ""}`].filter(
    Boolean,
  );
  return parts.join(", ") || null;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${
      encodeURIComponent(address)
    }`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_UA,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const rows = await res.json() as Array<{ lat?: string; lon?: string }>;
  const row = rows?.[0];
  if (!row?.lat || !row?.lon) return null;

  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

async function resolveAnchor(
  anchor?: AnchorInput,
  anchorLine?: string,
): Promise<{ lat: number; lon: number }> {
  const line = anchorLine?.trim() || formatAnchorLine(anchor);
  if (line) {
    const point = await geocodeAddress(line);
    if (point) return point;
  }
  return DEFAULT_ANCHOR;
}

async function driveMinutes(
  origin: { lat: number; lon: number },
  dest: { lat: number; lon: number },
): Promise<{ minutes: number | null; distanceMiles: number | null; error?: string }> {
  const coords =
    `${origin.lon},${origin.lat};${dest.lon},${dest.lat}`;
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    return {
      minutes: null,
      distanceMiles: null,
      error: `Routing HTTP ${res.status}`,
    };
  }

  const data = await res.json() as {
    code?: string;
    routes?: Array<{ duration?: number; distance?: number }>;
  };

  const route = data.routes?.[0];
  if (!route || data.code !== "Ok") {
    return {
      minutes: null,
      distanceMiles: null,
      error: "No driving route found",
    };
  }

  const seconds = route.duration;
  const meters = route.distance;
  if (seconds == null || !Number.isFinite(seconds)) {
    return { minutes: null, distanceMiles: null, error: "Invalid route duration" };
  }

  return {
    minutes: Math.max(1, Math.round(seconds / 60)),
    distanceMiles: meters != null && Number.isFinite(meters)
      ? Math.round((meters / 1609.344) * 10) / 10
      : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "POST required" }, 405);
  }

  let addresses: string[] = [];
  let anchor: AnchorInput | undefined;
  let anchorLine: string | undefined;

  try {
    const body = await req.json();
    if (Array.isArray(body?.addresses)) {
      addresses = body.addresses.map((a: unknown) => String(a ?? "").trim()).filter(Boolean);
    } else if (typeof body?.address === "string") {
      addresses = [body.address.trim()].filter(Boolean);
    }
    if (body?.anchor && typeof body.anchor === "object") {
      anchor = body.anchor as AnchorInput;
    }
    if (typeof body?.anchorLine === "string") {
      anchorLine = body.anchorLine;
    }
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!addresses.length) {
    return json({ ok: false, error: "address or addresses required" }, 400);
  }

  if (addresses.length > 12) {
    return json({ ok: false, error: "Too many addresses (max 12)" }, 400);
  }

  const origin = await resolveAnchor(anchor, anchorLine);
  const results: Record<string, RouteResult> = {};
  const unique = [...new Set(addresses)];

  for (let i = 0; i < unique.length; i++) {
    const address = unique[i]!;
    if (i > 0) {
      await sleep(1100);
    }

    try {
      const point = await geocodeAddress(address);
      if (!point) {
        results[address] = {
          minutes: null,
          error: "Could not geocode address",
        };
        continue;
      }

      const route = await driveMinutes(origin, point);
      results[address] = {
        minutes: route.minutes,
        distanceMiles: route.distanceMiles,
        error: route.error,
      };
    } catch (e) {
      results[address] = {
        minutes: null,
        error: e instanceof Error ? e.message : "Commute lookup failed",
      };
    }
  }

  return json({ ok: true, results });
});
