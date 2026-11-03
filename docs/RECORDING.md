# Recording a backup

No backup recording was produced in this workspace. The machine was not connected to LiveKit or a phone, so there was no live call audio to capture.

When the live stack is up, record the real session:

1. Start the patient browser on one side and the family browser on the other.
2. On Windows, Xbox Game Bar (Win+Alt+R) records the patient window, including system audio if the stereo mix or the browser is the default output.
3. Put the phone on speaker so the reminder call is in the room, or enable Twilio call recording on the trunk for that rehearsal number only.
4. In LiveKit Cloud, open the session and use the room recording or the session audio download if the project has recording enabled. That file is the cleanest copy of what Grok and the participants said.
5. Keep the family dashboard visible in a second capture if you need the live updates in the same video. A split with OBS is enough: one scene, two browser windows, and the microphone monitoring the phone.

Save the file outside the repo if it contains a real phone number. Do not claim a recording exists until the file is actually on disk.

The presenter script is `docs/PRESENTER_SCRIPT.md`.
