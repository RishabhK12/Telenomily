import { errorResponse } from "@/lib/errors";
import { applyWebhook } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    return Response.json(await applyWebhook(body, request.headers.get("authorization")));
  } catch (error) {
    return errorResponse(error);
  }
}
