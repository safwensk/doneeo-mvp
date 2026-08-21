import {
  CANONICAL_ARCHITECTURE_VERSION,
  DOMAIN_LAYERS,
  PLATFORM_LAYERS,
} from "../../../lib/canonical-architecture";

export const runtime = "edge";

export function GET() {
  return Response.json(
    {
      version: CANONICAL_ARCHITECTURE_VERSION,
      principle: "One WorkCase · one JobOrder · versioned artifacts · guarded progression",
      domainLayers: DOMAIN_LAYERS,
      platformLayers: PLATFORM_LAYERS,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}
