"""OLAF Storyteller Agent definition.

Provides two invocation modes:
1. storyteller_agent — A single LlmAgent with all tools (used by coordinator /
   direct Runner invocation from REST endpoints).
2. story_pipeline — A SequentialAgent for memory chapter creation:
   narrative_writer → illustrator → assembler.

The REST endpoints use storyteller_agent directly (simpler). The pipeline is
available for advanced orchestration if needed.
"""

from google.adk.agents import Agent, SequentialAgent

from olaf_agents.instructions.storyteller import (
    ASSEMBLER_INSTRUCTION,
    ILLUSTRATOR_INSTRUCTION,
    NARRATIVE_WRITER_INSTRUCTION,
    STORYTELLER_INSTRUCTION,
)
from olaf_agents.tools.storyteller_tools import (
    generate_illustration,
    get_conversation_summaries,
    get_health_logs,
    get_user_memories,
    save_health_narrative,
    save_memory_chapter,
    save_weekly_report,
)

# ── Single agent (used by coordinator & REST endpoints) ──────────────────────

storyteller_agent = Agent(
    model="gemini-2.5-flash",
    name="storyteller",
    description=(
        "Creates illustrated stories from memories, daily health narratives, "
        "weekly family reports, and legacy storybooks."
    ),
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
    output_key="storyteller_result",
)

# ── Pipeline agents (SequentialAgent for memory chapter creation) ─────────────

narrative_writer = Agent(
    model="gemini-2.5-flash",
    name="narrative_writer",
    description="Extracts and writes a rich narrative from a conversation transcript.",
    instruction=NARRATIVE_WRITER_INSTRUCTION,
    output_key="narrative",
)

illustrator = Agent(
    model="gemini-2.5-flash",
    name="illustrator",
    description="Generates illustration prompts and creates images for a narrative.",
    instruction=ILLUSTRATOR_INSTRUCTION,
    tools=[generate_illustration],
    output_key="illustrations",
)

assembler = Agent(
    model="gemini-2.5-flash",
    name="assembler",
    description="Combines narrative and illustrations into a saved memory chapter.",
    instruction=ASSEMBLER_INSTRUCTION,
    tools=[save_memory_chapter],
    output_key="assembled_chapter",
)

story_pipeline = SequentialAgent(
    name="story_pipeline",
    description="Full pipeline: transcript → narrative → illustrations → saved chapter",
    sub_agents=[narrative_writer, illustrator, assembler],
)
