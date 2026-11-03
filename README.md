# Telenomily

Medication companion for an older patient coming home from the hospital, with a shared family view. The product name defaults to Telenomily and can be changed with `NEXT_PUBLIC_PRODUCT_NAME`.

This repository started as a title only. RxMind ([github.com/RishabhK12/RxMind](https://github.com/RishabhK12/RxMind)) is a Flutter app plus a static Next.js marketing site. Its schedule ideas (discharge instructions, clock doses, reminders, and a check in that is not a clinical score) are reimplemented here in TypeScript. The RxMind site was not copied, because a static export cannot host auth, LiveKit, or phone calls.

Medication scanning is implemented in this repo. It is inspired by [Nomi](https://gtbigdatabigimpact.com/projects/nomi). There is no Nomi API, trained model, or partnership.

Grok is the only model provider. The LiveKit voice plugin speaks of an OpenAI-compatible client, and that client is pinned to `wss://api.x.ai/v1`.

## Layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js app for patients, family, and the presenter |
| `apps/agent` | LiveKit agent on Node.js 22, using `@livekit/agents-plugin-xai` |
| `packages/domain` | Schedules, matching, access rules, and tests |
| `supabase/migrations` | Postgres schema, policies, and invite function |
| `docs` | Setup, demo script, fixtures, recording |

## Run the labeled rehearsal

Rehearsal does not dial a phone and does not pretend a video room connected.

```bash
npm install
copy .env.example apps\web\.env.local
```

Set these in `apps/web/.env.local`:

```
APP_MODE=rehearsal
PRESENTER_ACCESS_CODE=choose-a-code
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Open `http://localhost:3000/login`. Continue as Elena or Mateo. The presenter panel is `/presenter`.

## Tests and build

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Live setup

See [docs/SETUP.md](docs/SETUP.md) and [docs/DEMO.md](docs/DEMO.md). The three minute demo is [docs/PRESENTER_SCRIPT.md](docs/PRESENTER_SCRIPT.md). Fixture notes are [docs/FIXTURES.md](docs/FIXTURES.md).

This is not a medical device.
