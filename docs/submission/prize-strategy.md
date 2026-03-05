# CARIA — Prize Category Strategy

**Hackathon:** Gemini Live Agent Challenge
**Deadline:** March 16, 2026

This document contains targeting paragraphs and talking points for each prize category we are competing for. Judges score each category separately; these paragraphs can be added to or adapted from the main Devpost submission as needed.

---

## Grand Prize

**Why CARIA should win the Grand Prize:**

CARIA is the most complete demonstration of what the Gemini Live Agent Challenge is actually asking for: a live, multimodal, multi-agent application that does something genuinely important in the world. It is not a proof of concept. It is a product — deployed on Cloud Run, with a real design system, real data persistence, real family notifications, and a real user in mind.

The technical scope is broad: Gemini Live API with ephemeral tokens, session resumption, and affective dialog for the voice companion; Gemini 2.5 Flash across four ADK agents with correct orchestration patterns (sub_agents, AgentTool, SequentialAgent, before_tool_callback); Imagen 3 via Vertex AI for illustrated memory chapters; Playwright on Cloud Run for headless browser navigation; Firebase Auth, Firestore, Cloud Storage, and FCM for a complete data and notification layer. No feature is faked. Every component works.

But the strongest argument for the Grand Prize is the problem. 54 million elderly Americans live in chronic social isolation. The digital divide leaves them locked out of the services they depend on. Their stories go untold. Their families worry. CARIA addresses all of this with a unified, voice-first, empathy-first experience. The Gemini API is not a tool in CARIA — it is the presence that makes the whole thing possible.

---

## Best Use of Gemini Live Agents

**Why CARIA demonstrates the best use of Live Agents:**

CARIA's voice companion is one of the most demanding real-world applications of the Gemini Live API we could imagine. It does not use the API as a novelty — it uses every meaningful capability the API provides:

- **Direct WebSocket connection** from the browser (`gemini-2.5-flash-native-audio-preview-12-2025`), not proxied through a server, for the lowest possible latency with an elderly user who needs natural conversation pacing.
- **Ephemeral tokens with `liveConnectConstraints`** — the system instruction, model, voice (`Kore`), and all four tool declarations are locked server-side via the `v1alpha/authTokens` API. No client-side tampering is possible with CARIA's behavior.
- **Session resumption** — `sessionResumptionUpdate` handles are stored and used on reconnection, including on `goAway` messages. Combined with `contextWindowCompression: { slidingWindow: {} }`, conversations last as long as Maria needs them to — there is no "session expired" experience.
- **Multimodal input** — JPEG frames are streamed at ~1 FPS during medication scans. The model reads the label, cross-references the prescription, and responds — in a single turn. Video is on-demand only, not continuous, to manage context window consumption.
- **Non-blocking tool calls with scheduling** — `flag_emotional_distress` is NON_BLOCKING with SILENT scheduling (the conversation continues; the flag is absorbed invisibly). `log_health_checkin` is NON_BLOCKING with SILENT scheduling (health data is persisted in the background). `set_reminder` is NON_BLOCKING with WHEN_IDLE scheduling (confirmed at a natural pause). `analyze_medication` is blocking with INTERRUPT scheduling (the user is waiting for the answer). This scheduling model is the correct way to use the Live API's function calling system for a conversational UX — not one tool behavior for all calls.
- **VAD tuning for the target user** — `START_SENSITIVITY_LOW`, `END_SENSITIVITY_LOW`, `silenceDurationMs: 800` — specifically calibrated for elderly users who pause more, breathe between words, and should never be cut off mid-sentence.
- **`enableAffectiveDialog: true`** — CARIA's voice adapts to the emotional content of what she says. When she hears pain or sadness in Maria's voice, her response doesn't just change in words — it changes in tone.
- **Full transcript capture** — `inputAudioTranscription` and `outputAudioTranscription` accumulate a complete conversation log, sent to the backend on session end for health reports and memory journal triggers.

This is not a demo that shows one feature of the Live API. It is a production implementation that exercises the full capability surface.

---

## Best Creative Storytellers

**Why CARIA is the best creative storytelling application:**

The Memory Journal is the most emotionally significant feature CARIA offers, and it is built on a genuinely creative use of AI storytelling capabilities.

The pipeline begins with a spoken conversation. Maria tells CARIA about her wedding day — fragmented, non-linear, the way memory actually works. After the session, a three-stage ADK SequentialAgent pipeline transforms it:

1. `narrative_writer` takes the raw transcript and reshapes it into coherent, warm prose — explicitly instructed to preserve Maria's voice and personality, not to over-polish, not to make it sound like a language model wrote it.
2. `illustrator` reads the narrative and generates three scene description prompts, then calls Imagen 3 (`imagen-3.0-generate-002`) with our art direction: "Warm watercolor illustration, soft pastel colors, gentle diffused lighting, cozy and nostalgic atmosphere, suitable for elderly viewers, no text overlay, no harsh shadows, hand-painted feel." Each illustration captures a key moment from the memory.
3. `assembler` combines the narrative text and illustration URLs into a permanent memory chapter, stored in Firestore and Cloud Storage with Firebase download URLs (not expiring signed URLs) so the chapter exists indefinitely.

The output is not content. It is legacy. The chapter titled "The Day It Rained, and Then the Sun Came Out" will still exist when Maria can no longer tell the story. Her grandchildren will be able to read it.

The creative brief is unique in the hackathon space: the storyteller's job is not to impress the reader with the AI's intelligence. It is to make the reader feel that they are reading Maria's words, not a model's. That constraint — amplify the human voice, suppress the AI voice — produces output that is genuinely moving in a way that most AI-generated content is not.

The product also generates illustrated daily health narratives (Imagen 3 `fast` model for speed and cost) and weekly family reports — all with consistent visual style, all building toward a Legacy Storybook that can be compiled as a downloadable PDF.

---

## Best UI Navigators

**Why CARIA's NavigatorAgent is the best UI navigation implementation:**

The NavigatorAgent is a fully functional ADK agent controlling a real Playwright headless Chromium browser on Cloud Run. It does not mock navigation. It navigates real websites.

The architectural details matter:

- **Server-side browser** — Playwright runs on Cloud Run, not in the browser. The elderly user sees a stream of screenshots. This design decision is crucial: it means the browser has full server-side capabilities (no browser security restrictions on navigating third-party sites), screenshots are reliable regardless of client device, and the user's device doesn't need to run a headless browser.
- **Screenshot streaming to frontend** — Every navigation action produces a new screenshot, streamed to the `ScreenshotViewer` component in real time. The user watches CARIA navigate. Transparency is a safety feature.
- **`ask_user_confirmation` tool** — Before any login or form submission, the agent pauses and requests explicit user confirmation. This is implemented as a proper ADK tool, not a prompt instruction — the agent cannot proceed without a response, and the response is recorded.
- **`before_tool_callback` — `validate_navigation_safety`** — Every navigation URL is validated before Playwright acts. Blocked schemes (non-HTTP), blocked domains (gambling, adult content), and the audit log are enforced at the callback level, not in the prompt. This cannot be prompted around.
- **Plain language narration** — The agent's instruction explicitly requires it to explain each action in simple terms: "I'm clicking the blue button that says Check Status." Every screenshot is accompanied by a verbal description that Maria can follow.
- **Pre-configured task templates** — Pension portal, medical appointment booking, medical report reading, subsidy form filling — common tasks for elderly users have tested navigation flows with known entry points.

For an elderly user who has been locked out of the digital world by interfaces designed for people thirty years younger, the NavigatorAgent is genuinely transformative. It is not AI generating text about a website. It is AI sitting beside the user and navigating the website for them.

---

## Best Innovation

**Why CARIA is the most innovative project:**

Three innovations stand out:

**1. Ephemeral token with `liveConnectConstraints` for persona locking.** Most Gemini Live API implementations either expose a raw API key in the browser (insecure) or proxy all audio through a backend server (adds latency, adds cost, defeats the purpose of a real-time API). CARIA uses the `v1alpha/authTokens` endpoint to provision a one-use ephemeral token with `liveConnectConstraints` that lock CARIA's personality, voice, tools, and behavior server-side. The browser connects directly to Gemini, with zero latency overhead, and with zero ability to change who CARIA is. This is the correct architecture for a consumer AI product that needs both speed and security.

**2. Non-blocking multimodal tool calls with per-tool scheduling.** Most function-calling implementations treat all tools the same: the model calls a function, waits for the response, continues. CARIA uses the Live API's `NON_BLOCKING` behavior with per-tool scheduling (`SILENT`, `WHEN_IDLE`, `INTERRUPT`) to create a conversation that feels natural rather than transactional. Distress monitoring happens invisibly. Health logging happens in the background. Medication analysis interrupts because the user is waiting. This scheduling model is the difference between an AI that feels like a doctor performing a procedure and one that feels like a friend who happens to be paying attention.

**3. The SequentialAgent storytelling pipeline as a memory preservation system.** Using ADK's `SequentialAgent` to build a multi-stage creative pipeline — from spoken memory to prose narrative to illustrated watercolor chapter — is a novel use of agent orchestration for a genuinely human purpose. The pipeline's intermediate state flows through `output_key` session variables, with each specialized agent reading the previous agent's output. The result is a memory preservation system that produces output indistinguishable in warmth from something a thoughtful human editor would produce — but at the scale and speed of AI.

---

## Best Multimodal UX

**Why CARIA delivers the best multimodal user experience:**

CARIA uses four distinct input and output modalities in a unified experience, each chosen for a specific user need:

**Voice (input + output):** The primary modality for elderly users. Gemini Live API handles bidirectional real-time audio with affective dialog — CARIA's voice changes in response to emotional content, not just semantic content. Input VAD is tuned for elderly speech patterns. Output uses the `Kore` voice, which Gemini's voice quality team rates for warmth and clarity.

**Vision (input):** Medication scanning activates the camera on demand. JPEG frames are sent to Gemini's multimodal input. The model reads the label, understands it in context, and responds verbally — the user never touches a keyboard. The on-demand activation (not continuous video) keeps context costs manageable and session duration unlimited.

**Screenshot (output):** The NavigatorAgent outputs screenshots of the website it is navigating. This is a novel output modality: the user's screen becomes a window into a remote browser being operated on their behalf. They see exactly what CARIA sees. The visual output builds trust — they are not taking CARIA's word for what the pension portal says; they can see it.

**Illustrated cards (output):** Memory chapters, daily health narratives, and family reports are presented as illustrated cards — warm watercolor images generated by Imagen 3 alongside narrative text. The visual output transforms health data and personal memories into something that feels human and beautiful rather than clinical and cold.

**Text (ambient):** Transcription runs continuously and surfaces in the companion UI as a scrolling log. This serves hearing-impaired users and provides a readable record of what CARIA said — especially important for medication instructions that a user might want to reference after the conversation.

The multimodal design is not additive — each modality serves a purpose that the others cannot. Voice for presence. Vision for verification. Screenshots for transparency. Illustrations for meaning. Text for accessibility. The result is a UX that meets elderly users where they are, in the modality they need, for each kind of interaction they have.
