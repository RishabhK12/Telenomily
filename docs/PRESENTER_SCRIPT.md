# Presenter script

About three minutes. Extra beats are at the end for questions. Elena and Mateo are fictional. Say that before the first screen.

## 0:00 Sign in

Open the patient home as Elena. Point at today's clock doses and the as needed line. Say the as needed medicine is not a mandatory dose, and the stopped aspirin is absent on purpose.

## 0:30 Discharge sheet

Open the synthetic sheet in `apps/web/public/fixtures/discharge-elena.svg` on a second screen, or upload it from Scan a discharge sheet. Show the source text beside the extracted rows. Correct nothing unless a row is wrong. Confirm the schedule. Say a draft does not create doses until this confirmation.

## 1:10 Medicine check

Tap Start medicine check. Allow the camera and microphone. When the assistant asks, show a package. The still frame is taken once, saved, and spoken from that saved result. On a second device, open the family dashboard as Mateo and tap Join. Both sides should hear the assistant. The family camera is not the one being read.

If a label is blurry, the assistant asks for another view instead of guessing.

## 2:00 Family dashboard

On Mateo's screen, show the new check, the time, and the source line that says it came from the comparison. Mention completed check ins are not a recovery score.

## 2:20 Reminder call

From the presenter panel, start the patient reminder call. A phone on `DEMO_PATIENT_PHONE` should ring. Answer. Say you are unsure whether the dose was taken. The assistant must tell you not to take an extra dose, and the dashboard should show unsure before the call ends.

## 2:45 Close

Say the pharmacy call is the same kind of real call, to a teammate, and that a pharmacy sentence does not change the prescription.

## If someone asks

- Not on plan: show an ibuprofen style label. The plan is unchanged.
- Expired: a prescribed product with a past date. A replacement task is added once.
- Missing: finish the cabinet scan. Cephalexin is described as not found. A shopping task appears only after you confirm it is needed.
- Pill: imprint NC 10 on both sides can be a possible match. A blank pill or M 5 cannot.
- Foreign box: Paracetamol Sol is translated and mapped to the seeded US candidate, with a pharmacist warning.
- Pharmacy: the teammate reads the lines on the presenter card. DemoGen 500 mg can be recorded as a preverified candidate. A different strength is rejected. The plan stays as confirmed.
- Judge QR: generate it on the presenter panel. It works once, expires, and opens only Elena's family view.

## If credentials are missing

Stay on rehearsal mode and say so. Do not describe a blocked call as a successful ring. The panel lists the exact missing settings.
