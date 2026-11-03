import { answerDemoCall, currentDemoCall, endDemoCall, loadLaptopFamilyBoard, runLaptopDemo, showOnDemoCall, startDemoCall } from "@/lib/demo-hub";

export const dynamic = "force-dynamic";

function demoError(error: unknown) {
  const message = error instanceof Error ? error.message : "The laptop demo could not run.";
  const status = message.includes("APP_MODE=rehearsal") ? 403 : 400;
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("call") === "1") {
      return Response.json({ call: await currentDemoCall() });
    }
    return Response.json(await loadLaptopFamilyBoard());
  } catch (error) {
    return demoError(error);
  }
}

export async function POST(request: Request) {
  try {
    let body: { scene?: unknown; action?: unknown; caption?: unknown; image?: unknown; status?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Send a scene name." }, { status: 400 });
    }
    if (body.action === "ring") return Response.json({ call: await startDemoCall() });
    if (body.action === "answer") return Response.json({ call: await answerDemoCall() });
    if (body.action === "end") return Response.json({ call: await endDemoCall() });
    if (body.action === "show") {
      return Response.json({
        call: await showOnDemoCall({
          caption: typeof body.caption === "string" ? body.caption : undefined,
          image: typeof body.image === "string" ? body.image : body.image === null ? null : undefined,
          status: typeof body.status === "string" ? body.status : undefined,
        }),
      });
    }
    if (typeof body.scene !== "string" || body.scene.trim().length === 0) {
      return Response.json({ error: "Send a scene name." }, { status: 400 });
    }
    return Response.json(await runLaptopDemo(body.scene));
  } catch (error) {
    return demoError(error);
  }
}
