export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const key = process.env.GOOglemap_API_KEY;
    if (!key) return Response.json({ error: "Google Maps key is not configured" }, { status: 503 });
    const body = await request.json() as { addresses?: string[] };
    const addresses = (body.addresses || []).map(value => String(value).trim()).filter(value => value.length > 4).slice(0, 8);
    if (addresses.length < 2) return Response.json({ error: "At least two complete addresses are required" }, { status: 400 });
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex" },
      body: JSON.stringify({ origin: { address: addresses[0] }, destination: { address: addresses[addresses.length - 1] }, intermediates: addresses.slice(1, -1).map(address => ({ address })), travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", optimizeWaypointOrder: addresses.length > 2, languageCode: "en-CA", units: "METRIC" }),
    });
    const data = await response.json() as { routes?: Array<{ duration?: string; distanceMeters?: number; legs?: Array<{ duration?: string; distanceMeters?: number }>; polyline?: { encodedPolyline?: string }; optimizedIntermediateWaypointIndex?: number[] }>; error?: { message?: string } };
    if (!response.ok || !data.routes?.[0]) return Response.json({ error: data.error?.message || "Google could not calculate this route" }, { status: response.status || 502 });
    const route = data.routes[0];
    const seconds = Number(String(route.duration || "0s").replace("s", ""));
    const legs = (route.legs || []).map((leg, index) => ({ from: addresses[index], to: addresses[index + 1], distanceKm: Math.round(((leg.distanceMeters || 0) / 1000) * 10) / 10, trafficMinutes: Math.max(1, Math.ceil(Number(String(leg.duration || "0s").replace("s", "")) / 60)) }));
    return Response.json({ source: "Google Routes API", distanceKm: Math.round(((route.distanceMeters || 0) / 1000) * 10) / 10, trafficMinutes: Math.max(1, Math.ceil(seconds / 60)), legs, encodedPolyline: route.polyline?.encodedPolyline || "", optimizedIntermediateWaypointIndex: route.optimizedIntermediateWaypointIndex || [] });
  } catch {
    return Response.json({ error: "Route calculation failed" }, { status: 500 });
  }
}
