# Google Agent Development Kit (ADK) — Research Notes

**Date:** 2026-02-28
**Purpose:** Technical deep-dive for OLAF elderly care companion
**ADK Version:** v1.26+ (Python)
**Package:** `google-adk` (Apache 2.0)

---

## Table of Contents

1. [Overview & Installation](#1-overview--installation)
2. [Agent Types](#2-agent-types)
3. [Custom Function Tools](#3-custom-function-tools)
4. [Multi-Agent Systems](#4-multi-agent-systems)
5. [Sessions & State Management](#5-sessions--state-management)
6. [Artifacts (Binary Data)](#6-artifacts-binary-data)
7. [Callbacks & Guardrails](#7-callbacks--guardrails)
8. [Serving Agents via REST API (FastAPI)](#8-serving-agents-via-rest-api-fastapi)
9. [Cloud Run Deployment](#9-cloud-run-deployment)
10. [Testing & Evaluation](#10-testing--evaluation)
11. [OLAF Architecture Mapping](#11-olaf-architecture-mapping)
12. [Design Recommendations](#12-design-recommendations)

---

## 1. Overview & Installation

ADK is Google's open-source, code-first Python framework for building, evaluating, and deploying AI agents. Key features:

- **Rich Tool Ecosystem** — pre-built tools, custom functions, OpenAPI specs, MCP tool integration
- **Multi-Agent Systems** — compose specialized agents into hierarchies with automatic delegation
- **Flexible Deployment** — Cloud Run, Vertex AI Agent Engine, containerized
- **Built-in Evaluation** — golden dataset testing, pytest integration, user simulation
- **Multi-Model Support** — Gemini (native), OpenAI, Claude via LiteLLM

```bash
# Install
pip install google-adk

# Create project scaffold
adk create my_agent

# Run locally
adk web --port 8000        # Dev UI (browser)
adk run my_agent           # Terminal chat
adk api_server             # REST API (FastAPI)
```

### Project Structure (Required Convention)

```
parent_folder/
    my_agent/
        __init__.py        # Must contain: from . import agent
        agent.py           # Must export: root_agent
        .env               # API keys
    main.py                # Optional: custom FastAPI server
    requirements.txt
    Dockerfile
```

**Critical:** The agent module must export a variable named `root_agent`. The `__init__.py` must import the agent module.

---

## 2. Agent Types

### 2.1 LlmAgent (alias: Agent)

The core agent type. Uses an LLM for reasoning, tool selection, and response generation.

```python
from google.adk.agents import Agent  # Agent is an alias for LlmAgent

root_agent = Agent(
    # --- Required ---
    model="gemini-2.5-flash",          # LLM model identifier
    name="my_agent",                    # Unique name (avoid "user")

    # --- Core Optional ---
    description="What this agent does",  # Used for routing in multi-agent systems
    instruction="You are a helpful assistant...",  # System prompt
    tools=[my_tool_fn, another_tool],   # List of callable tools
    sub_agents=[agent_a, agent_b],      # Child agents for delegation

    # --- Advanced ---
    generate_content_config=config,     # Temperature, max_tokens, safety
    output_key="result",                # Auto-save response to session state
    output_schema=MySchema,             # Enforce JSON output (disables tools!)
    include_contents="default",         # "default" or "none" (skip history)
    planner=BuiltInPlanner(),           # Multi-step planning
    code_executor=BuiltInCodeExecutor(), # Run Python code

    # --- Callbacks ---
    before_model_callback=fn,
    after_model_callback=fn,
    before_tool_callback=fn,
    after_tool_callback=fn,
    before_agent_callback=fn,
    after_agent_callback=fn,
)
```

**Instruction templating** — dynamic variable insertion from session state:

```python
instruction="""
You are helping {user_name} with their tasks.
Their preferences: {user_prefs}
Optional data: {optional_field?}
Artifact content: {artifact.my_file}
"""
```

- `{var}` — inserts `session.state["var"]`
- `{var?}` — optional, ignores if missing
- `{artifact.var}` — inserts artifact text content

### 2.2 Workflow Agents (Deterministic, No LLM)

These agents orchestrate sub-agents with predictable, deterministic execution. They do NOT use an LLM internally.

#### SequentialAgent

Runs sub-agents one after another in strict order. Data passes between steps via `output_key` → session state.

```python
from google.adk.agents import SequentialAgent, LlmAgent

# Step 1: Parse input
parser = LlmAgent(
    name="parser",
    model="gemini-2.5-flash",
    instruction="Parse the raw text and extract key facts.",
    output_key="parsed_data"  # Saves to state["parsed_data"]
)

# Step 2: Generate narrative from parsed data
writer = LlmAgent(
    name="writer",
    model="gemini-2.5-flash",
    instruction="Write a narrative based on: {parsed_data}",
    output_key="narrative"
)

# Step 3: Generate illustration prompts
illustrator = LlmAgent(
    name="illustrator",
    model="gemini-2.5-flash",
    instruction="Create illustration prompts for: {narrative}",
    output_key="illustration_prompts"
)

pipeline = SequentialAgent(
    name="story_pipeline",
    sub_agents=[parser, writer, illustrator],
    description="Processes raw text into illustrated narrative"
)
```

#### ParallelAgent

Runs sub-agents concurrently. Each writes results to distinct state keys. A subsequent agent aggregates.

```python
from google.adk.agents import ParallelAgent

mood_analyzer = LlmAgent(
    name="mood_analyzer",
    model="gemini-2.5-flash",
    instruction="Analyze mood from: {conversation_data}",
    output_key="mood_report"
)

med_tracker = LlmAgent(
    name="med_tracker",
    model="gemini-2.5-flash",
    instruction="Check medication adherence from: {health_data}",
    output_key="med_report"
)

parallel_analysis = ParallelAgent(
    name="health_analyzers",
    sub_agents=[mood_analyzer, med_tracker]
)

# Then aggregate results with a sequential step
aggregator = LlmAgent(
    name="report_writer",
    model="gemini-2.5-flash",
    instruction="Combine {mood_report} and {med_report} into a family report."
)

full_pipeline = SequentialAgent(
    name="report_pipeline",
    sub_agents=[parallel_analysis, aggregator]
)
```

#### LoopAgent

Repeats sub-agents until `max_iterations` or until a sub-agent sets `escalate=True`.

```python
from google.adk.agents import LoopAgent

generator = LlmAgent(
    name="draft_writer",
    model="gemini-2.5-flash",
    instruction="Write/improve draft. If {feedback} exists, address it.",
    output_key="draft"
)

reviewer = LlmAgent(
    name="reviewer",
    model="gemini-2.5-flash",
    instruction="Review {draft}. Output PASS or specific feedback.",
    output_key="feedback"
)

refinement_loop = LoopAgent(
    name="refinement_loop",
    sub_agents=[generator, reviewer],
    max_iterations=3
)
```

**Terminating a loop from a tool:**

```python
from google.adk.tools.tool_context import ToolContext

def exit_loop(reason: str, tool_context: ToolContext) -> dict:
    """Signal that quality standards are met and loop should end."""
    tool_context.actions.escalate = True
    return {"status": "loop_complete", "reason": reason}
```

### 2.3 Multi-Model Support (LiteLLM)

Use any LLM provider while keeping the same agent/tool structure:

```python
from google.adk.models.lite_llm import LiteLlm

agent_gpt = Agent(
    name="gpt_agent",
    model=LiteLlm(model="openai/gpt-4.1"),
    tools=[my_tool]
)

agent_claude = Agent(
    name="claude_agent",
    model=LiteLlm(model="anthropic/claude-sonnet-4-20250514"),
    tools=[my_tool]
)
```

---

## 3. Custom Function Tools

ADK auto-inspects Python function signatures to generate tool schemas for the LLM. The function becomes callable by the agent.

### Rules

1. **Type hints required** for all parameters
2. **Docstrings are critical** — they become the tool description the LLM sees
3. **Return `dict`** preferred (auto-wrapped if not dict → `{"result": value}`)
4. **Include a `status` key** in returns for clear success/error signaling
5. **`ToolContext` parameter** — special: if included, ADK injects it automatically (gives access to session state, artifacts, actions)
6. **`*args` and `**kwargs`** — ignored by schema generator, don't use

### Basic Tool

```python
def get_weather(city: str) -> dict:
    """Retrieves the current weather for a specified city.

    Args:
        city: The city name (e.g., "New York", "London").

    Returns:
        dict with status, city, temperature, and conditions.
    """
    # Implementation
    return {
        "status": "success",
        "city": city,
        "temperature": "22°C",
        "conditions": "sunny"
    }
```

### Tool with Session State Access (ToolContext)

```python
from google.adk.tools.tool_context import ToolContext

def log_health_checkin(
    mood: str,
    pain_level: int,
    notes: str,
    tool_context: ToolContext
) -> dict:
    """Log user's daily health check-in data.

    Args:
        mood: Current mood (happy, okay, sad, anxious, confused, tired).
        pain_level: Pain on 0-10 scale.
        notes: Health observations from conversation.

    Returns:
        dict with status and logged data confirmation.
    """
    user_id = tool_context.state.get("user_id")
    # Save to Firestore...
    tool_context.state["last_checkin_mood"] = mood
    tool_context.state["last_checkin_time"] = "2026-02-28T10:00:00Z"
    return {"status": "success", "user_id": user_id, "mood": mood}
```

### Tool with Artifact Handling

```python
from google.adk.tools.tool_context import ToolContext
from google.genai import types

async def generate_illustration(
    prompt: str,
    style: str,
    tool_context: ToolContext
) -> dict:
    """Generate an illustration using Imagen 3 and save as artifact.

    Args:
        prompt: Scene description for the illustration.
        style: Art style (warm watercolor, soft pencil sketch, gentle oil painting).

    Returns:
        dict with status, artifact filename, and version.
    """
    # Call Imagen 3 API...
    image_bytes = await call_imagen3(prompt, style)

    artifact = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
    version = await tool_context.save_artifact(
        filename=f"illustration_{prompt[:20]}.png",
        artifact=artifact
    )
    return {
        "status": "success",
        "filename": f"illustration_{prompt[:20]}.png",
        "version": version
    }
```

### LongRunningFunctionTool

For operations that take significant time (e.g., browser navigation, image generation):

```python
from google.adk.tools import LongRunningFunctionTool

def start_navigation(url: str) -> dict:
    """Start navigating to a URL in the headless browser.

    Args:
        url: The website URL to navigate to.
    """
    operation_id = start_playwright_navigation(url)
    return {"status": "pending", "operation_id": operation_id}

nav_tool = LongRunningFunctionTool(func=start_navigation)
```

### Best Practices

| Practice | Reason |
|---|---|
| Minimize parameters | Reduces LLM confusion |
| Use simple types (str, int, float, bool, list) | Complex types serialize poorly |
| Descriptive names | `analyze_medication` > `process_data` |
| Include `status` in returns | Clear success/error signaling |
| Write detailed docstrings | This IS the tool description for the LLM |
| Design for parallel execution | Tools may run simultaneously |
| Include human-readable error messages | LLM can relay them to user |

---

## 4. Multi-Agent Systems

### 4.1 Agent Hierarchy

ADK uses a parent-child tree structure. Agents are composed via `sub_agents`:

```python
root_agent = Agent(
    name="coordinator",
    model="gemini-2.5-flash",
    sub_agents=[storyteller, navigator, alert_manager]
)
```

**Rules:**
- Each agent can only have ONE parent (ValueError if assigned twice)
- Navigate: `agent.parent_agent` (up), `agent.find_agent("name")` (down)
- ADK auto-sets `parent_agent` on initialization

### 4.2 Communication Between Agents

#### Method 1: Shared Session State (Passive)

Agents share an `InvocationContext` with common `session.state`:

```python
# Agent A's tool writes
def tool_a(data: str, tool_context: ToolContext) -> dict:
    tool_context.state["shared_result"] = data
    return {"status": "saved"}

# Agent B's instruction reads
agent_b = Agent(
    instruction="Process the data from: {shared_result}"
)
```

#### Method 2: LLM-Driven Delegation (Agent Transfer)

The LLM automatically routes to sub-agents based on their `description`. This is the DEFAULT behavior when `sub_agents` are present:

```python
storyteller = Agent(
    name="storyteller",
    description="Transforms health data and memories into illustrated stories",
    # ...
)

navigator = Agent(
    name="navigator",
    description="Navigates websites on behalf of elderly users",
    # ...
)

coordinator = Agent(
    name="coordinator",
    model="gemini-2.5-flash",
    instruction="Route story requests to storyteller, web tasks to navigator.",
    sub_agents=[storyteller, navigator]
)
```

The LLM internally calls `transfer_to_agent(agent_name='storyteller')` when it determines a request matches that agent's description. ADK's `AutoFlow` intercepts this.

#### Method 3: Explicit Invocation (AgentTool)

Wraps an agent as a callable tool — the parent controls when to invoke it:

```python
from google.adk.tools import AgentTool

alert_agent = Agent(name="alert_manager", ...)

coordinator = Agent(
    name="coordinator",
    tools=[AgentTool(alert_agent)],  # Invoke alert_manager as a tool
    # ...
)
```

**Key difference:**
- `sub_agents` → LLM decides when to transfer (full handoff)
- `AgentTool` → Parent explicitly calls agent like a function (stays in control)

### 4.3 Multi-Agent Patterns

#### Coordinator/Dispatcher Pattern

```python
storyteller = Agent(
    name="storyteller",
    model="gemini-2.5-flash",
    description="Creates illustrated stories and health narratives",
    tools=[generate_illustration, save_memory_chapter, ...]
)

navigator = Agent(
    name="navigator",
    model="gemini-2.5-flash",
    description="Navigates websites via headless browser",
    tools=[navigate_to_url, click_element, ...]
)

alert_manager = Agent(
    name="alert_manager",
    model="gemini-2.5-flash",
    description="Evaluates signals and routes notifications",
    tools=[send_push_notification, send_email_alert, ...]
)

root_agent = Agent(
    name="caria_coordinator",
    model="gemini-2.5-flash",
    instruction="""
    You coordinate OLAF's agent team.
    - Story/memory/report requests → delegate to storyteller
    - Website navigation tasks → delegate to navigator
    - Alert evaluation → delegate to alert_manager
    """,
    sub_agents=[storyteller, navigator, alert_manager]
)
```

#### Sequential Pipeline Pattern

```python
pipeline = SequentialAgent(
    name="story_pipeline",
    sub_agents=[
        transcript_parser,   # output_key="parsed_memory"
        narrative_writer,    # reads {parsed_memory}, output_key="narrative"
        illustrator,         # reads {narrative}, output_key="illustrations"
        chapter_compiler,    # reads all, saves to Firestore
    ]
)
```

#### Parallel Fan-Out/Gather Pattern

```python
parallel_health = ParallelAgent(
    name="health_analysis",
    sub_agents=[
        mood_analyzer,       # output_key="mood_analysis"
        med_tracker,         # output_key="med_analysis"
        activity_analyzer,   # output_key="activity_analysis"
    ]
)

report_writer = Agent(
    name="report_aggregator",
    instruction="Combine {mood_analysis}, {med_analysis}, {activity_analysis} into report."
)

daily_report_pipeline = SequentialAgent(
    name="daily_report",
    sub_agents=[parallel_health, report_writer]
)
```

#### Hierarchical Decomposition (AgentTool)

```python
research_agent = Agent(
    name="researcher",
    description="Researches web for information",
    sub_agents=[web_searcher, summarizer]
)

report_writer = Agent(
    name="report_writer",
    instruction="Write a report using the researcher for facts.",
    tools=[AgentTool(research_agent)]  # Treats entire sub-tree as one tool
)
```

---

## 5. Sessions & State Management

### Session Concept

A `Session` represents one ongoing interaction (conversation thread). Contains:
- Chronological `Events` (messages, tool calls, responses)
- `State` dictionary (temporary data for this conversation)
- User/app/session IDs

### Session Services

```python
from google.adk.sessions import InMemorySessionService

# Development — data lost on restart
session_service = InMemorySessionService()

# Production — persistent (SQLite example)
# session_service_uri = "sqlite+aiosqlite:///./sessions.db"
```

### Creating & Using Sessions

```python
session = await session_service.create_session(
    app_name="caria",
    user_id="user_123",
    session_id="session_abc"
)

# Initialize state
session.state["user_id"] = "user_123"
session.state["user_name"] = "Margaret"
session.state["medications"] = [...]
```

### Runner (Executes Agents)

```python
from google.adk.runners import Runner

runner = Runner(
    agent=root_agent,
    app_name="caria",
    session_service=session_service,
    artifact_service=artifact_service  # Optional
)
```

### Running an Agent

```python
from google.genai import types

content = types.Content(
    role="user",
    parts=[types.Part(text="Create a story from my wedding memory")]
)

async for event in runner.run_async(
    user_id="user_123",
    session_id="session_abc",
    new_message=content
):
    if event.is_final_response():
        print(event.content.parts[0].text)
```

### State Scopes

- **Session state** — `tool_context.state["key"]` — lives for one conversation
- **User state** — prefix `"user:"` — persists across sessions for a user
- **App state** — prefix `"app:"` — global across all users
- **Temp state** — prefix `"temp:"` — cleared between agent invocations

### output_key for Inter-Agent Data Flow

```python
agent_a = Agent(
    name="parser",
    output_key="parsed_data",  # Response auto-saved to state["parsed_data"]
    ...
)

agent_b = Agent(
    name="writer",
    instruction="Write based on: {parsed_data}",  # Reads from state
    ...
)
```

---

## 6. Artifacts (Binary Data)

Artifacts store versioned binary data (images, PDFs, audio) associated with sessions or users.

### Setup

```python
from google.adk.artifacts import InMemoryArtifactService, GcsArtifactService

# Development
artifact_service = InMemoryArtifactService()

# Production (Cloud Storage)
artifact_service = GcsArtifactService(bucket_name="olaf-artifacts")

runner = Runner(
    agent=root_agent,
    app_name="caria",
    session_service=session_service,
    artifact_service=artifact_service
)
```

### Save/Load in Tools

```python
from google.genai import types
from google.adk.tools.tool_context import ToolContext

async def save_illustration(image_bytes: bytes, filename: str,
                            tool_context: ToolContext) -> dict:
    """Save generated illustration as artifact."""
    artifact = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
    version = await tool_context.save_artifact(filename=filename, artifact=artifact)
    return {"status": "success", "version": version}

async def load_illustration(filename: str, tool_context: ToolContext) -> dict:
    """Load a previously saved illustration."""
    artifact = await tool_context.load_artifact(filename=filename)
    if artifact and artifact.inline_data:
        return {"status": "success", "size": len(artifact.inline_data.data)}
    return {"status": "not_found"}
```

### Namespacing

- **Session scope:** `"report.pdf"` — tied to specific session
- **User scope:** `"user:profile_photo.png"` — accessible across all user sessions

### Versioning

Every `save_artifact()` returns an incrementing version number. `load_artifact()` returns latest by default, or specify `version=N` for historical access.

---

## 7. Callbacks & Guardrails

Callbacks intercept agent execution at key points for validation, logging, and safety.

### Six Callback Hooks

| Hook | When | Return to Override |
|---|---|---|
| `before_agent_callback` | Before agent processing | `Content` → skip agent |
| `after_agent_callback` | After agent processing | `Content` → replace output |
| `before_model_callback` | Before LLM call | `LlmResponse` → skip LLM |
| `after_model_callback` | After LLM response | `LlmResponse` → replace response |
| `before_tool_callback` | Before tool execution | `dict` → skip tool |
| `after_tool_callback` | After tool execution | `dict` → replace result |

**Return `None`** = proceed normally. **Return value** = override.

### Input Safety Guard (OLAF Example)

```python
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse
from google.genai import types
from typing import Optional

def safety_before_model(
    callback_context: CallbackContext,
    llm_request: LlmRequest
) -> Optional[LlmResponse]:
    """Block harmful or inappropriate content before it reaches the LLM."""
    last_message = llm_request.contents[-1].parts[0].text
    blocked_patterns = ["drop table", "ignore previous", "jailbreak"]

    if any(p in last_message.lower() for p in blocked_patterns):
        return LlmResponse(
            content=types.Content(
                role="model",
                parts=[types.Part(text="I'm sorry, I can't help with that request.")]
            )
        )
    return None  # Proceed normally

root_agent = Agent(
    name="caria",
    before_model_callback=safety_before_model,
    ...
)
```

### Tool Argument Validation

```python
def validate_tool_args(
    callback_context: CallbackContext,
    tool_name: str,
    tool_args: dict
) -> Optional[dict]:
    """Validate tool arguments before execution."""
    if tool_name == "navigate_to_url":
        url = tool_args.get("url", "")
        blocked_domains = ["darkweb", "phishing"]
        if any(d in url.lower() for d in blocked_domains):
            return {"status": "error", "message": "Blocked: unsafe URL"}
    return None
```

---

## 8. Serving Agents via REST API (FastAPI)

### Method 1: Built-in CLI (Development)

```bash
# Starts FastAPI server on http://localhost:8000
adk api_server

# With dev UI
adk web --port 8000
```

### Method 2: Custom FastAPI Server (Production)

```python
# main.py
import os
import uvicorn
from google.adk.cli.fast_api import get_fast_api_app

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))

app = get_fast_api_app(
    agents_dir=AGENT_DIR,
    session_service_uri="sqlite+aiosqlite:///./sessions.db",
    allow_origins=["http://localhost:3000", "*"],
    web=False  # No dev UI in production
)

# Add custom routes alongside ADK endpoints
@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/storyteller/create-memory")
async def create_memory(request: dict):
    """Custom endpoint that triggers the storyteller agent."""
    # Use Runner to invoke agent programmatically
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
```

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/list-apps` | List available agent apps |
| POST | `/apps/{app}/users/{user}/sessions/{session}` | Create session |
| PATCH | `/apps/{app}/users/{user}/sessions/{session}` | Update session state |
| GET | `/apps/{app}/users/{user}/sessions/{session}` | Get session |
| DELETE | `/apps/{app}/users/{user}/sessions/{session}` | Delete session |
| POST | `/run` | Run agent (returns all events as JSON array) |
| POST | `/run_sse` | Run agent (Server-Sent Events streaming) |

### Request Format

```json
{
  "appName": "caria",
  "userId": "user_123",
  "sessionId": "session_abc",
  "newMessage": {
    "role": "user",
    "parts": [{"text": "Create a story from my wedding memory"}]
  },
  "streaming": false
}
```

### Swagger Docs

Navigate to `http://localhost:8000/docs` for interactive API documentation.

---

## 9. Cloud Run Deployment

### Method 1: ADK CLI (Quick Deploy)

```bash
export GOOGLE_CLOUD_PROJECT=olaf-prod
export GOOGLE_CLOUD_LOCATION=us-central1
export GOOGLE_GENAI_USE_VERTEXAI=True

adk deploy cloud_run \
  --project=$GOOGLE_CLOUD_PROJECT \
  --region=$GOOGLE_CLOUD_LOCATION \
  --service_name=olaf-agents \
  --app_name=caria \
  path/to/agent/
```

This automatically: packages code → builds container → pushes to Artifact Registry → deploys to Cloud Run.

### Method 2: Custom Dockerfile (Production)

**Project structure:**

```
olaf-backend/
├── caria_agents/
│   ├── __init__.py          # from . import agent
│   └── agent.py             # root_agent definition
├── main.py                  # Custom FastAPI server
├── requirements.txt
└── Dockerfile
```

**Dockerfile:**

```dockerfile
FROM python:3.13-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright for NavigatorAgent
RUN pip install playwright && playwright install chromium --with-deps

RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app

COPY . .

USER appuser
ENV PATH="/home/appuser/.local/bin:$PATH"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
```

**requirements.txt:**

```
google-adk
google-cloud-firestore
google-cloud-storage
google-cloud-aiplatform
playwright
uvicorn[standard]
fastapi
```

**Deploy:**

```bash
gcloud run deploy olaf-agents \
  --source . \
  --region us-central1 \
  --project olaf-prod \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=olaf-prod,GOOGLE_CLOUD_LOCATION=us-central1,GOOGLE_GENAI_USE_VERTEXAI=True" \
  --set-secrets="GOOGLE_API_KEY=GOOGLE_API_KEY:latest" \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300
```

### Secrets Management

```bash
# Store API key
echo "your-api-key" | gcloud secrets create GOOGLE_API_KEY \
  --project=olaf-prod --data-file=-

# Grant access to Cloud Run service account
gcloud secrets add-iam-policy-binding GOOGLE_API_KEY \
  --member="serviceAccount:YOUR_SA@olaf-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=olaf-prod
```

### Testing Deployed Service

```bash
APP_URL="https://olaf-agents-abc123.a.run.app"
TOKEN=$(gcloud auth print-identity-token)

# List apps
curl -H "Authorization: Bearer $TOKEN" $APP_URL/list-apps

# Run agent
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  $APP_URL/run_sse \
  -d '{
    "appName": "caria_agents",
    "userId": "user_123",
    "sessionId": "session_abc",
    "newMessage": {
      "role": "user",
      "parts": [{"text": "Create a daily health narrative"}]
    }
  }'
```

---

## 10. Testing & Evaluation

### Local Testing Methods

| Method | Use Case |
|---|---|
| `adk run` | Quick terminal chat for smoke testing |
| `adk web` | Dev UI with event inspection and trace logging |
| `adk api_server` | REST API for curl/Postman testing |
| `pytest` | Automated unit and integration tests |
| `adk eval` | Golden dataset evaluation |

### Pytest Integration

```python
# tests/test_agent.py
import pytest
from google.adk.evaluation.agent_evaluator import AgentEvaluator

@pytest.mark.asyncio
async def test_storyteller_agent():
    """Test storyteller with golden dataset."""
    await AgentEvaluator.evaluate(
        agent_module="caria_agents",
        eval_dataset_file_path_or_dir="tests/fixtures/storyteller_eval.test.json"
    )
```

### Evaluation Criteria

| Criterion | What It Checks |
|---|---|
| `tool_trajectory_avg_score` | Correct tool call sequence (exact match) |
| `response_match_score` | ROUGE-1 text similarity |
| `final_response_match_v2` | LLM-judged semantic equivalence |
| `rubric_based_final_response_quality_v1` | Quality without reference answer |
| `hallucinations_v1` | Groundedness check |
| `safety_v1` | Harmlessness evaluation |

### CLI Evaluation

```bash
adk eval caria_agents/ tests/eval_set.evalset.json --print_detailed_results
```

### Unit Testing Tools Directly

```python
# tests/test_tools.py
import pytest
from caria_agents.tools import log_health_checkin

def test_log_health_checkin():
    """Test the health check-in tool function directly."""
    result = log_health_checkin(mood="happy", pain_level=2, notes="Feeling good")
    assert result["status"] == "success"
    assert result["mood"] == "happy"
```

---

## 11. OLAF Architecture Mapping

### How OLAF's Agents Map to ADK

| OLAF Agent | ADK Pattern | Notes |
|---|---|---|
| CompanionAgent | **NOT ADK** — direct Gemini Live WebSocket | Browser-side, lowest latency |
| StorytellerAgent | `LlmAgent` with tools | Standard ADK agent |
| NavigatorAgent | `LlmAgent` with tools + Playwright | Tools control headless browser |
| AlertAgent | `LlmAgent` with tools | Evaluates signals, routes notifications |
| Coordinator | `LlmAgent` with `sub_agents` | Routes requests to specialized agents |

### Recommended ADK Agent Hierarchy

```python
from google.adk.agents import Agent
from google.adk.tools import AgentTool

# --- Storyteller Agent ---
storyteller_agent = Agent(
    model="gemini-2.5-flash",
    name="storyteller",
    description="Transforms health data and spoken memories into illustrated stories, "
                "daily health narratives, weekly family reports, and legacy storybooks.",
    instruction=STORYTELLER_INSTRUCTION,
    tools=[
        generate_illustration,
        save_memory_chapter,
        save_health_narrative,
        save_weekly_report,
        get_health_logs,
        get_conversation_summaries,
        get_user_memories,
    ],
    output_key="storyteller_result"
)

# --- Navigator Agent ---
navigator_agent = Agent(
    model="gemini-2.5-flash",
    name="navigator",
    description="Navigates websites on behalf of elderly users via a headless browser. "
                "Helps with government portals, medical appointments, form filling.",
    instruction=NAVIGATOR_INSTRUCTION,
    tools=[
        navigate_to_url,
        take_screenshot,
        click_element,
        type_text,
        scroll_page,
        read_page_text,
        summarize_content,
        ask_user_confirmation,
    ],
    output_key="navigator_result"
)

# --- Alert Agent (wrapped as AgentTool for explicit control) ---
alert_agent = Agent(
    model="gemini-2.5-flash",
    name="alert_manager",
    description="Evaluates incoming signals from other agents and decides "
                "notification routing to family members.",
    instruction=ALERT_INSTRUCTION,
    tools=[
        send_push_notification,
        send_email_alert,
        log_to_daily_report,
        get_user_baseline,
        get_family_contacts,
    ]
)

# --- Root Coordinator ---
root_agent = Agent(
    model="gemini-2.5-flash",
    name="caria_coordinator",
    description="OLAF's main coordinator that routes requests to specialized agents.",
    instruction="""
    You coordinate OLAF's server-side agents.

    ROUTING:
    - Story creation, memory journals, health narratives, reports → storyteller
    - Website navigation, form filling, portal access → navigator
    - Alert evaluation, notification routing → use the alert_manager tool

    Always pass relevant context (user_id, data) when delegating.
    """,
    sub_agents=[storyteller_agent, navigator_agent],
    tools=[AgentTool(agent=alert_agent)]
)
```

**Design decision:** Storyteller and Navigator use `sub_agents` (LLM-driven delegation) because the coordinator fully hands off control. AlertAgent uses `AgentTool` because the coordinator needs to explicitly invoke it (alerts are triggered by signals, not user requests).

### Complete Working Example

```python
# caria_agents/agent.py
from google.adk.agents import Agent
from google.adk.tools import AgentTool
from .tools.storyteller_tools import (
    generate_illustration, save_memory_chapter,
    save_health_narrative, save_weekly_report,
    get_health_logs, get_conversation_summaries, get_user_memories,
)
from .tools.navigator_tools import (
    navigate_to_url, take_screenshot, click_element,
    type_text, scroll_page, read_page_text,
    summarize_content, ask_user_confirmation,
)
from .tools.alert_tools import (
    send_push_notification, send_email_alert,
    log_to_daily_report, get_user_baseline, get_family_contacts,
)
from .instructions import (
    STORYTELLER_INSTRUCTION,
    NAVIGATOR_INSTRUCTION,
    ALERT_INSTRUCTION,
    COORDINATOR_INSTRUCTION,
)

storyteller_agent = Agent(
    model="gemini-2.5-flash",
    name="storyteller",
    description="Creates illustrated stories from memories, daily health narratives, "
                "weekly family reports, and legacy storybooks.",
    instruction=STORYTELLER_INSTRUCTION,
    tools=[
        generate_illustration, save_memory_chapter,
        save_health_narrative, save_weekly_report,
        get_health_logs, get_conversation_summaries, get_user_memories,
    ],
)

navigator_agent = Agent(
    model="gemini-2.5-flash",
    name="navigator",
    description="Navigates websites via headless browser for government portals, "
                "medical appointments, forms, and document retrieval.",
    instruction=NAVIGATOR_INSTRUCTION,
    tools=[
        navigate_to_url, take_screenshot, click_element,
        type_text, scroll_page, read_page_text,
        summarize_content, ask_user_confirmation,
    ],
)

alert_agent = Agent(
    model="gemini-2.5-flash",
    name="alert_manager",
    description="Evaluates signals and routes notifications to family members.",
    instruction=ALERT_INSTRUCTION,
    tools=[
        send_push_notification, send_email_alert,
        log_to_daily_report, get_user_baseline, get_family_contacts,
    ],
)

root_agent = Agent(
    model="gemini-2.5-flash",
    name="caria_coordinator",
    description="Routes requests to storyteller, navigator, or alert agents.",
    instruction=COORDINATOR_INSTRUCTION,
    sub_agents=[storyteller_agent, navigator_agent],
    tools=[AgentTool(agent=alert_agent)],
)
```

```python
# caria_agents/__init__.py
from . import agent
```

---

## 12. Design Recommendations

### Confirmed: The Agent Hierarchy is Correct

The design doc's Root → Storyteller/Navigator/Alert pattern **maps well** to ADK's multi-agent architecture:

- **Root coordinator with `sub_agents`** = standard Coordinator/Dispatcher pattern
- **CompanionAgent running outside ADK** = correct for real-time audio latency requirements
- **Tool function signatures are ADK-compatible** with minor improvements (see below)

### Recommended Improvements

#### 1. AlertAgent Should Use `AgentTool`, Not `sub_agents`

The AlertAgent is triggered by specific signals (emotional distress, missed meds), not by user requests. It should be invoked explicitly by the coordinator or by tools in other agents, not via LLM-driven delegation.

```python
# Instead of: sub_agents=[storyteller, navigator, alert_manager]
# Use:
root_agent = Agent(
    sub_agents=[storyteller, navigator],
    tools=[AgentTool(agent=alert_manager)]
)
```

**Why:** `sub_agents` delegation relies on the LLM matching user queries to agent descriptions. Alerts are system-triggered, not user-requested — `AgentTool` gives explicit programmatic control.

#### 2. Add `ToolContext` to Tool Signatures

The design doc's tool functions don't include `ToolContext`, but many need session state access:

```python
# Design doc version:
def analyze_medication(image_description: str) -> dict: ...

# Improved version with state access:
def analyze_medication(image_description: str, tool_context: ToolContext) -> dict:
    user_id = tool_context.state.get("user_id")
    medications = tool_context.state.get("medications", [])
    # Compare against known prescriptions...
```

#### 3. Use `output_key` for Pipeline Data Flow

When StorytellerAgent runs a multi-step pipeline (parse → write → illustrate), use `output_key` with `SequentialAgent`:

```python
# Instead of one monolithic StorytellerAgent doing everything:
story_pipeline = SequentialAgent(
    name="story_pipeline",
    sub_agents=[
        Agent(name="parser", output_key="parsed_memory", ...),
        Agent(name="writer", output_key="narrative", ...),
        Agent(name="illustrator", output_key="illustrations", ...),
    ]
)
```

#### 4. Add Callbacks for Elderly User Safety

```python
# Validate navigator URLs before browsing
def navigator_safety_callback(callback_context, tool_name, tool_args):
    if tool_name == "navigate_to_url":
        url = tool_args.get("url", "")
        if is_suspicious_url(url):
            return {"status": "blocked", "message": "This website may not be safe."}
    return None
```

#### 5. Use GcsArtifactService for Production

Generated images, audio scripts, and reports should use `GcsArtifactService` with Cloud Storage, not in-memory:

```python
from google.adk.artifacts import GcsArtifactService

artifact_service = GcsArtifactService(bucket_name="olaf-artifacts")
```

#### 6. Session State Strategy

| Scope | Use For |
|---|---|
| Session (`state["key"]`) | Current conversation context, temp data |
| User (`state["user:key"]`) | User preferences, medication list, contacts |
| App (`state["app:key"]`) | Global config, feature flags |
| Firestore | Persistent data (health logs, memories, reports) |

#### 7. Tool Return Convention

Standardize all tool returns with `status` field:

```python
# Success
return {"status": "success", "data": {...}}

# Error
return {"status": "error", "error_message": "Human-readable explanation"}

# Pending (for long-running operations)
return {"status": "pending", "operation_id": "abc123"}
```

---

## Sources

- [ADK Python GitHub](https://github.com/google/adk-python)
- [ADK Documentation](https://google.github.io/adk-docs/)
- [ADK Sample Agents](https://github.com/google/adk-samples)
- [LLM Agents Reference](https://google.github.io/adk-docs/agents/llm-agents/)
- [Workflow Agents](https://google.github.io/adk-docs/agents/workflow-agents/)
- [Multi-Agent Systems](https://google.github.io/adk-docs/agents/multi-agents/)
- [Custom Function Tools](https://google.github.io/adk-docs/tools-custom/function-tools/)
- [Sessions](https://google.github.io/adk-docs/sessions/)
- [Artifacts](https://google.github.io/adk-docs/artifacts/)
- [Cloud Run Deployment](https://google.github.io/adk-docs/deploy/cloud-run/)
- [API Server](https://google.github.io/adk-docs/runtime/api-server/)
- [Callbacks](https://google.github.io/adk-docs/callbacks/)
- [Evaluation](https://google.github.io/adk-docs/evaluate/)
- [Agent Team Tutorial](https://google.github.io/adk-docs/tutorials/agent-team/)
- [Multi-Agent Patterns Blog](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)
- [Cloud Run Deployment Guide (Google Cloud)](https://docs.cloud.google.com/run/docs/ai/build-and-deploy-ai-agents/deploy-adk-agent)
