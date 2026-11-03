import { runtimeMode } from "@/lib/runtime";

export const dynamic = "force-dynamic";

let frame: Uint8Array | null = null;

export async function GET() {
  if (runtimeMode() !== "rehearsal" || !frame) {
    return new Response(null, { status: 204 });
  }
  const bytes = new Uint8Array(frame);
  return new Response(bytes, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  if (runtimeMode() !== "rehearsal") {
    return new Response(null, { status: 403 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > 0 && bytes.byteLength < 1_500_000) frame = bytes;
  return new Response(null, { status: 204 });
}
