"""OLAF Alert Manager Agent definition.

Evaluates incoming signals and routes notifications to family members.
Wrapped as AgentTool for explicit invocation by the coordinator.
"""

from google.adk.agents import Agent

from olaf_agents.instructions.alert import ALERT_INSTRUCTION
from olaf_agents.tools.alert_tools import (
    create_alert,
    escalate_alert,
    evaluate_signal,
    get_family_contacts,
    get_user_baseline,
    log_to_daily_report,
    send_email_alert,
    send_push_notification,
)

alert_agent = Agent(
    model="gemini-2.5-flash",
    name="alert_manager",
    description=(
        "Evaluates incoming signals from other agents and decides "
        "notification routing to family members."
    ),
    instruction=ALERT_INSTRUCTION,
    tools=[
        evaluate_signal,
        create_alert,
        escalate_alert,
        send_push_notification,
        send_email_alert,
        log_to_daily_report,
        get_user_baseline,
        get_family_contacts,
    ],
)
