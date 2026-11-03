import { AccessToken, AgentDispatchClient, SipClient, WebhookReceiver } from "livekit-server-sdk";
import { AppError } from "./errors";

function livekitHost(): string {
  const url = process.env.LIVEKIT_URL?.trim();
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !key || !secret) {
    throw new AppError(503, "livekit_unconfigured", "Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET before starting a live room.");
  }
  return url;
}

export async function participantToken(identity: string, roomName: string, name: string): Promise<string> {
  livekitHost();
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "15m",
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}

export async function dispatchAgent(roomName: string, metadata: Record<string, string>): Promise<void> {
  const host = livekitHost();
  const client = new AgentDispatchClient(host, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  await client.createDispatch(roomName, process.env.LIVEKIT_AGENT_NAME || "telenomily", {
    metadata: JSON.stringify(metadata),
  });
}

export async function dialPhone(roomName: string, phone: string, identity: string, displayName: string): Promise<void> {
  const trunk = process.env.LIVEKIT_SIP_TRUNK_ID?.trim();
  if (!trunk) {
    throw new AppError(503, "sip_unconfigured", "Set LIVEKIT_SIP_TRUNK_ID to the LiveKit outbound trunk connected to Twilio.");
  }
  const host = livekitHost();
  const sip = new SipClient(host, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  try {
    await sip.createSipParticipant(trunk, phone, roomName, {
      participantIdentity: identity,
      participantName: displayName,
      waitUntilAnswered: false,
      playDialtone: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The phone provider rejected the call.";
    throw new AppError(502, "call_failed", message);
  }
}

export async function readLiveKitWebhook(body: string, authorization: string | null): Promise<{ event: string; roomName: string | null; callStatus: string | null; id: string }> {
  livekitHost();
  const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY ?? "", process.env.LIVEKIT_API_SECRET ?? "");
  const event = await receiver.receive(body, authorization ?? "");
  const roomName = event.room?.name ?? null;
  const callStatus = event.participant?.attributes?.["sip.callStatus"] ?? null;
  return { event: event.event, roomName, callStatus, id: event.id };
}
