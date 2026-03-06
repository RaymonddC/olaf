"""OLAF root agent definition.

Exports `root_agent` as required by ADK convention.
The coordinator routes requests to storyteller, navigator, or alert agents.
"""

from google.adk.agents import Agent
from google.adk.tools import AgentTool

from .agents.storyteller import storyteller_agent
from .agents.navigator import navigator_agent
from .agents.alert import alert_agent
from .callbacks.safety import safety_before_model
from .instructions.coordinator import COORDINATOR_INSTRUCTION

root_agent = Agent(
    model="gemini-2.5-flash",
    name="caria_coordinator",
    description="Routes requests to storyteller, navigator, or alert agents.",
    instruction=COORDINATOR_INSTRUCTION,
    sub_agents=[storyteller_agent, navigator_agent],
    tools=[AgentTool(agent=alert_agent)],
    before_model_callback=safety_before_model,
)
