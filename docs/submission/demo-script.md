# CARIA — 4-Minute Demo Script

**Hackathon:** Gemini Live Agent Challenge
**Target runtime:** 3:50 – 4:00
**Tone:** Warm, human, emotionally honest — judges should feel the weight of the problem before they ever see the UI.

---

## OPENING — The Problem (0:00 – 0:30)

*[No product on screen. Black frame or a single still photograph: an elderly woman alone at a kitchen table, morning light, a cup of tea going cold.]*

**Voiceover (measured, quiet):**

> "Every day, 54 million Americans over the age of 65 wake up alone.
>
> Not because their families don't love them. But because life moved on — children live an hour away, work gets busy, and a phone call once a week starts to feel like enough.
>
> Meanwhile, she has seven different medications to manage. A pension portal she hasn't been able to log into in three years. A memory of her wedding day that nobody has ever really asked about.
>
> Her name is Maria. She is 76 years old. And today — for the first time — she has someone to talk to who always has time."

*[Fade in: CARIA logo. Soft ambient sound. Title card: "CARIA — AI Elderly Care Companion"]*

---

## ACT 1 — The Voice Companion (0:30 – 1:30)

*[Screen: The Talk page. Large microphone button. Clean, high-contrast design. 18px+ text throughout. Nothing moves unexpectedly.]*

**Voiceover:**

> "CARIA's talk page is Maria's front door. One button. That's it."

*[Demo: Maria taps the microphone. The circular AudioVisualizer begins its gentle pulse. Status shows "Connecting..." then "Listening".]*

**Voiceover:**

> "In the background, CARIA requests an ephemeral token from our backend — a cryptographically locked credential that lets the browser connect directly to Gemini's Live API WebSocket. Maria's audio never hits a proxy. The latency is as low as the API allows."

*[Demo: CARIA speaks in a warm voice ("Kore" voice, affective dialog enabled).]*

**CARIA (voice, slightly slow, warm):**
> "Good morning, Maria! How are you feeling today?"

**Maria (voice):**
> "Oh, a bit tired. My knee has been bothering me."

*[In real time, the transcript appears below. The model is listening — VAD tuned to LOW sensitivity, 800ms silence threshold, so Maria can pause between words without being cut off.]*

**CARIA:**
> "I'm sorry to hear that, Maria. Pain of about a five today? I'll make a note. You've had a few days like this — I'll mention it in the report for your daughter."

*[Non-blocking in the background: `log_health_checkin` fires silently — mood tagged "tired", pain level 5, notes logged. Maria doesn't see the tool call. She just experiences a conversation.]*

**Voiceover:**

> "Under the hood: Gemini issued a non-blocking function call to `log_health_checkin`. Our backend persisted the health data to Firestore. Maria experienced nothing but a caring response."

---

## ACT 2 — The Medication Scan (1:30 – 2:00)

*[Demo: Maria holds a medication bottle toward the webcam.]*

**Maria:**
> "I can never remember if I've taken the metformin today or not."

*[Camera button activates. JPEG frames at ~1 FPS stream to Gemini's multimodal input.]*

**CARIA:**
> "I can see the label — Metformin 500mg, twice daily with meals. Your prescription shows you should take this at breakfast and dinner. Have you had breakfast yet?"

**Maria:**
> "Yes, about an hour ago."

**CARIA:**
> "Then this morning's dose is the right time. Go ahead and take it now, and I'll remind you again this evening at six."

*[`analyze_medication` fired as a blocking call — Gemini analyzed the label, cross-referenced against Maria's medication list from session state. `set_reminder` scheduled for 18:00, `WHEN_IDLE` scheduling so CARIA confirms at a natural pause.]*

**Voiceover:**

> "This is Gemini's multimodal vision doing real clinical work. No OCR library. No separate microservice. The model reads the label, cross-references the prescription, and sets the reminder — in a single, seamless turn of conversation."

---

## ACT 3 — The Memory Journal (2:00 – 2:40)

*[Screen transitions to the Memories page. Warm watercolor illustrations are visible — illustrated cards with soft pastel chapter headers.]*

**Voiceover:**

> "But Maria isn't just a list of medications and health scores. She has a life. Forty years of marriage. Three grandchildren. A garden she's tended since 1982."

*[Demo: We play back a brief clip of Maria speaking to CARIA.]*

**Maria (in session, earlier):**
> "I remember the morning of my wedding. It rained all night, and my mother said it was bad luck. But when I walked out of the church, the sun came out, and James was standing there with his eyes just... full. That look. I've never forgotten it."

**Voiceover:**

> "When Maria finishes speaking, CARIA saves the transcript and triggers our StorytellerAgent pipeline — three specialized ADK agents working in sequence."

*[Diagram overlay: `narrative_writer` → `illustrator` → `assembler`]*

> "The narrative writer reshapes her words into prose. The illustrator generates three scene prompts and calls Imagen 3 via Vertex AI. The assembler combines everything into a permanent chapter — stored in Cloud Storage with a watercolor illustration: a bride stepping into sunlight, her new husband's eyes full of joy."

*[Demo: The completed chapter card appears. Soft watercolor of a couple on church steps in morning light. Title: "The Day It Rained, and Then the Sun Came Out".]*

> "Maria's family can read this. Her grandchildren can read this. Someday, this chapter will still exist long after Maria cannot tell the story herself."

*[Pause. Let that land.]*

---

## ACT 4 — The Digital Navigator (2:40 – 3:10)

*[Screen: Navigator session. A live screenshot of a government portal is visible inside the CARIA interface. CARIA's description of what she's doing runs in a panel alongside.]*

**Maria (speaking to companion):**
> "Can you help me check my pension? I can never figure out that website."

**Voiceover:**

> "Maria just launched our NavigatorAgent — an ADK agent with a live Playwright headless browser running on Cloud Run. It navigates the real web on her behalf."

**CARIA (voice, narrating):**
> "I'm opening the pension portal now. I can see a 'Check Status' button — I'm clicking it. It's asking for your ID number. Can you read it out to me and I'll type it in?"

*[Demo: Screenshots stream to the UI in real time. The navigator_guard callback validates every URL before the agent acts. The `ask_user_confirmation` tool pauses before any form submission.]*

**CARIA:**
> "It says your next payment is scheduled for March 15th, for $1,247. Would you like me to read out the full statement?"

**Voiceover:**

> "The web is not designed for Maria. Government portals, medical booking systems, insurance documents — they assume mouse precision and twenty-year-old eyes. CARIA navigates them for her, narrating every step, never acting without her approval."

---

## ACT 5 — The Family Dashboard (3:10 – 3:40)

*[Screen: Family Dashboard, viewed from a laptop perspective — Maria's daughter Sarah checking in from work.]*

**Voiceover:**

> "Meanwhile, 40 miles away, Sarah opens the family dashboard."

*[Demo: The dashboard shows:
- Today's overview: Maria, mood "tired", pain level 5, medications taken
- A green badge: "Morning dose confirmed 9:14 AM"
- A health log graph for the week — mood trend slightly downward
- An alert: "Knee pain reported 3 consecutive days — may warrant follow-up"
- The new memory chapter: "The Day It Rained, and Then the Sun Came Out"]*

**Voiceover:**

> "Sarah sees what she needs to know — not a clinical spreadsheet, but a human picture of her mother's week. The alert about the knee pain was generated by our AlertAgent, which evaluated three days of health logs and decided this pattern was worth surfacing — but not urgent enough to call at midnight."

*[Demo: Sarah taps the memory chapter. The watercolor illustration fills the screen. She reads the first paragraph.]*

> "And for a moment, Sarah knows something about her mother she might not have known otherwise — the look on James's face, fifty years ago, when the sun came out."

*[Beat.]*

---

## CLOSING — The Vision (3:40 – 4:00)

*[Return to the opening image: Maria at her kitchen table. This time, her phone is lit up. She's smiling.]*

**Voiceover:**

> "CARIA is not an app. It is presence.
>
> It is the companion that never gets too busy. The memory keeper that never forgets. The navigator that sits beside you on every confusing website. The quiet watchman that tells your daughter when something seems wrong.
>
> Built with Gemini's Live API for real-time voice and vision. Google ADK for a four-agent intelligent backend. Imagen 3 for illustrated memories that last a lifetime.
>
> CARIA. For the people who deserve more than a weekly phone call."

*[Title card: CARIA. caria.care]*

---

## Demo Logistics Notes

**Screen recording sequence:**
1. Talk page — voice session with medication scan (record live or pre-recorded audio playback)
2. Memories page — show completed chapter with watercolor illustration
3. Navigator session — government portal flow (use a test/mock portal for reliability)
4. Family dashboard — pre-populated with a week of demo data

**Key visuals to emphasize:**
- The AudioVisualizer pulse during CARIA speaking
- The watercolor illustration reveal on the memory chapter
- The live screenshot streaming in the navigator panel
- The alert card on the family dashboard with the three-day knee pain pattern

**Voice:**
- Use CARIA's actual Gemini voice (Kore voice, affective dialog enabled) for the in-product moments
- Voiceover should be a different human voice — warm, measured, not sales-y

**Emotional beats to protect:**
- The pause after "Someday, this chapter will still exist long after Maria cannot tell the story herself"
- The pause before "And for a moment, Sarah knows something about her mother..."
- The final line — let it breathe before cutting to title card
