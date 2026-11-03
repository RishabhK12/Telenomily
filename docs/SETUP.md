# Setup still required in the dashboards

The app code is in the repo. These dashboard steps are not done until you complete them in your own accounts. Nothing below is pre-provisioned.

## Supabase

1. Create a project.
2. Run `supabase/migrations/20261102120000_init.sql` in the SQL editor.
3. Run `supabase/seed.sql`.
4. In Authentication, enable email and password. Disable open signups if the project is public, then create users only through the seed script.
5. Open Settings, then API Keys. There is no Project Settings, then API page. Copy the project URL, the publishable key, and a secret key into `apps/web/.env.local`. The publishable key goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The secret key goes in `SUPABASE_SERVICE_ROLE_KEY`. Never expose the secret key to the browser. A legacy `anon` or `service_role` key works in those same two variables if that is what the page shows.
6. Confirm Realtime is enabled for `activity_events`, `dose_reports`, `calls`, `scan_results`, `symptom_reports`, `pharmacy_updates`, `shopping_tasks`, and `rooms`. The migration adds them to `supabase_realtime` when that publication exists.
7. Confirm the private Storage bucket `documents` exists. The migration inserts it.

Then:

```bash
npm run seed
```

`scripts/seed-demo.ts` creates the demo patient and demo family auth users from `DEMO_PATIENT_EMAIL`, `DEMO_PATIENT_PASSWORD`, `DEMO_FAMILY_EMAIL`, and `DEMO_FAMILY_PASSWORD`, then inserts the fictional plan. Do not commit those passwords.

## LiveKit Cloud

1. Create a project and copy `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and the websocket URL into `NEXT_PUBLIC_LIVEKIT_URL`.
2. Install the LiveKit CLI and authenticate it.
3. From `apps/agent`, deploy with the Dockerfile in that folder:

```bash
cd apps/agent
lk agent create --region us-east
```

Use `apps/agent/livekit.example.toml` as the shape of the generated `livekit.toml`. Do not commit secrets. Set agent secrets in LiveKit Cloud: `XAI_API_KEY`, `AGENT_SHARED_SECRET`, `APP_URL`, `XAI_VOICE_MODEL`, `XAI_VOICE_NAME`.

4. Set `LIVEKIT_AGENT_NAME` to `telenomily` in both the web app and the agent. Explicit dispatch uses that name.
5. For local agent development: `npm run agent:dev` from the repo root, with the same secrets in `apps/agent/.env.local`.

The agent runtime is Node.js 22 because the current LiveKit Node SDK documents `@livekit/agents-plugin-xai` and `livekit-server-sdk` SIP calls. The voice model id defaults to `grok-voice-latest` and the voice to `ara`. Change them with env vars after checking [the LiveKit xAI page](https://docs.livekit.io/agents/models/realtime/spacexai/).

## Twilio and the SIP trunk

1. In Twilio, create an Elastic SIP trunk.
2. Add a credential list for termination (LiveKit placing outbound calls).
3. Put your Twilio number on the trunk.
4. In LiveKit, create an outbound trunk whose address, username, and password match that Twilio trunk. `lk sip outbound list` shows the trunk id.
5. Set `LIVEKIT_SIP_TRUNK_ID`.
6. Set `DEMO_PATIENT_PHONE` and `DEMO_PHARMACY_PHONE` to numbers you control.
7. Set `ALLOWED_CALL_NUMBERS` to those same numbers, comma separated. The server rejects every other destination.

Point LiveKit webhooks at `https://YOUR_APP/api/webhooks/livekit`.

## Vercel

1. Import the Git repository.
2. Set the root directory to `apps/web`.
3. Framework preset: Next.js. Include the monorepo so `packages/domain` is available. If Vercel does not install the workspace, set the install command to `cd ../.. && npm install` and the build command to `cd ../.. && npm run build -w @nomi/web`.
4. Add the same public and server env vars as `apps/web/.env.local`. `APP_MODE` must be empty or `live` in production. Do not set `rehearsal` on a public URL.
5. Set `NEXT_PUBLIC_APP_URL` to the Vercel URL so judge QR codes use the right host.

## xAI

Create an API key and set `XAI_API_KEY`. Default text and vision model is `grok-4.7`, taken from the structured output examples. If xAI renames the model, change `XAI_TEXT_MODEL` and `XAI_VISION_MODEL`. Do not add another provider.

## What was not verified from this machine

Supabase, LiveKit, Twilio, Vercel, and a real phone call were not executed here, because those accounts are not configured in the environment. Rehearsal mode, unit tests, typecheck, lint, and the production build are the checks that can run without them.
