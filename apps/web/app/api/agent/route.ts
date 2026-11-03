import { errorResponse } from "@/lib/errors";
import { agentContext, runAgentTool } from "@/lib/service";
import { toolRequestSchema } from "@nomi/domain";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const secret = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const url = new URL(request.url);
    if (url.searchParams.get("context") === "1") {
      return Response.json(await agentContext(secret, url.searchParams.get("room") ?? ""));
    }
    const parsed = toolRequestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "The tool request was not valid." }, { status: 400 });
    return Response.json(await runAgentTool(secret, parsed.data));
  } catch (error) {
    return errorResponse(error);
  }
}
