# Fixtures

Drawings in `apps/web/public/fixtures`:

| File | Use |
| --- | --- |
| `discharge-elena.svg` | Multipage stand-in is one sheet. Upload it when Grok is configured. |
| `lisinopril.svg` | On plan, future expiration |
| `ibuprofen.svg` | Not on plan |
| `vitamin-d-expired.svg` | Prescribed and expired |
| `unreadable.svg` | Can't confirm |
| `pill-nc-10.svg` | Both sides of the seeded pill |
| `paracetamol-sol.svg` | Spanish label with a documented US candidate |

Cephalexin is prescribed and has no drawing, so a finished scan can report it as not found. All pictures and names in `apps/web/public/fixtures` and `packages/domain/src/fixtures.ts` are synthetic. They are not photographs of commercial products and they are not FDA listings.

| Item | Role |
| --- | --- |
| Elena Vasquez | Fictional patient |
| Mateo Vasquez | Fictional son and family account |
| Lisinopril 10 mg tablet at 8:00 | On plan |
| Acetaminophen 500 mg, as needed | Stays off the mandatory schedule |
| Cholecalciferol 1000 IU, expiration in the past when the label says so | Expired and still prescribed |
| Cephalexin 500 mg | Prescribed and absent until someone shows it |
| Aspirin 81 mg delayed release | Stopped, not scheduled |
| Ibuprofen 200 mg | Not on the plan |
| Blurry or unreadable label | Can't confirm |
| Imprint NC 10 / 10, round, white, scored | Seeded pill reference `pill-nc-10` |
| Imprint M 5 on two white round cards | Ambiguous, must not match |
| Imprint QQ 0 | No reference |
| Paracetamol Sol 500 mg comprimidos | Spanish demo label mapped to Demo Relief acetaminophen 500 mg oral tablet |
| DemoGen acetaminophen 500 mg | Preverified generic candidate for the pharmacy scene. Price in the presenter card is 4.37 dollars of demo dialogue |

The paracetamol mapping records that paracetamol is the INN and acetaminophen is the USAN for the same ingredient, with the same strength, oral tablet, and immediate release on this seeded card. It is not an Orange Book rating and it does not authorize a substitution by itself.

Pill imprint text was written for this demo. It is not taken from a pill identifier database.

RxMind supplied the product idea of discharge organization, schedules, reminders, and recovery check ins. The Flutter models were not copied because they target on device storage. Nomi supplied the idea of reading an over the counter package into plain language. The vision calls in this app go to Grok.
