# How to demonstrate Telenomily

## Rehearsal, no provider accounts

1. Copy `.env.example` to `apps/web/.env.local`.
2. Set `APP_MODE=rehearsal`, `PRESENTER_ACCESS_CODE`, and `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
3. From the repo root, run `npm install` and `npm run dev`.
4. Open `http://localhost:3000/login`.
5. Continue as Elena for the patient home. Continue as Mateo, in another browser profile, for the family home. One browser profile holds one session cookie, so two profiles or two devices are required to watch both at once.
6. Elena's today list is the fictional confirmed plan. As needed acetaminophen is not a clock dose. Stopped aspirin is absent.
7. Scan a discharge sheet only works when `XAI_API_KEY` is set. Without it, the page says the sheet could not be read. It does not invent a plan.
8. Start medicine check in rehearsal returns a blocked message. It does not open a fake video room.
9. Open `/presenter`, enter the presenter code, and use Reset demo, the two call buttons, and Display judge QR code. The call buttons record that the call was not placed. They do not show a successful ring.
10. Scan the QR once. It opens Mateo's view of Elena only. A second scan says the invite was already used.

Synthetic drawings are in `apps/web/public/fixtures`. Notes are in `docs/FIXTURES.md`.

## Live path

Follow `docs/SETUP.md` until the presenter readiness list shows every group as Ready. Leave `APP_MODE` unset.

Then:

1. Sign in as the seeded patient and family accounts.
2. Upload `discharge-elena.svg` (or a photo of it), correct the rows, and confirm the plan.
3. On the patient phone, tap Start medicine check and allow the camera and microphone.
4. On the family phone, tap Join. Both sides should hear Grok. Show one fixture at a time: lisinopril, ibuprofen, the expired vitamin D drawing, the blurry label, the NC 10 pill, and Paracetamol Sol.
5. Say that the cabinet scan is finished. Cephalexin should be described as not found. Confirm it is needed only if you want the shopping task.
6. From the presenter panel, start the reminder call to `DEMO_PATIENT_PHONE`, then the pharmacy call to `DEMO_PHARMACY_PHONE`. The teammate reads the lines on the presenter card. The dashboard updates before the call ends.

The three minute narration is `docs/PRESENTER_SCRIPT.md`. Recording steps are `docs/RECORDING.md`. No backup recording file is in this repo.
