"""OLAF Navigator Agent definition.

Navigates websites via headless browser for government portals,
medical appointments, forms, and document retrieval.
"""

from google.adk.agents import Agent

from olaf_agents.callbacks.navigator_guard import validate_navigation_safety
from olaf_agents.instructions.navigator import NAVIGATOR_INSTRUCTION
from olaf_agents.tools.navigator_tools import (
    ask_user_confirmation,
    click_element,
    navigate_to_url,
    read_page_text,
    scroll_page,
    summarize_content,
    take_screenshot,
    type_text,
)

navigator_agent = Agent(
    model="gemini-2.5-flash",
    name="navigator",
    description=(
        "Navigates websites via headless browser for government portals, "
        "medical appointments, forms, and document retrieval."
    ),
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
    before_tool_callback=validate_navigation_safety,
    output_key="navigator_result",
)
