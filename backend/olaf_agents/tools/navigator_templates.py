"""OLAF — Pre-defined navigation task templates.

Each template provides a starting URL, step hints, and expected flow
so the NavigatorAgent can handle common tasks efficiently.
"""



class NavigatorTemplate:
    """A pre-defined navigation workflow."""

    def __init__(
        self,
        template_id: str,
        name: str,
        description: str,
        start_url: str,
        estimated_steps: int,
        step_hints: list[str],
        sensitive_actions: list[str],
    ):
        self.template_id = template_id
        self.name = name
        self.description = description
        self.start_url = start_url
        self.estimated_steps = estimated_steps
        self.step_hints = step_hints
        self.sensitive_actions = sensitive_actions

    def to_agent_context(self) -> str:
        """Format template as context for the agent instruction."""
        hints = "\n".join(f"  {i + 1}. {h}" for i, h in enumerate(self.step_hints))
        return (
            f"Task template: {self.name}\n"
            f"Start URL: {self.start_url}\n"
            f"Steps:\n{hints}\n"
            f"Sensitive actions requiring confirmation: {', '.join(self.sensitive_actions)}"
        )


# ── Template Definitions ─────────────────────────────────────────────────────

TEMPLATES: dict[str, NavigatorTemplate] = {
    "pension_check": NavigatorTemplate(
        template_id="pension_check",
        name="Check Pension Status",
        description="Navigate to the pension portal and check the user's pension status.",
        start_url="https://www.gov.uk/check-state-pension",
        estimated_steps=5,
        step_hints=[
            "Navigate to the pension portal.",
            "Look for a 'Check your State Pension' or 'Sign in' button and click it.",
            "Read the page content to find pension status information.",
            "Extract key details: pension amount, payment dates, qualifying years.",
            "Summarise the findings clearly for the user.",
        ],
        sensitive_actions=["login", "form_submit"],
    ),
    "book_appointment": NavigatorTemplate(
        template_id="book_appointment",
        name="Book a Doctor Appointment",
        description="Navigate to a clinic booking system to find and book an appointment.",
        start_url="https://www.nhs.uk/nhs-services/gps/how-to-register-with-a-gp-surgery/",
        estimated_steps=7,
        step_hints=[
            "Navigate to the clinic or GP booking page.",
            "Look for available appointment slots.",
            "Select a suitable date and time.",
            "Fill in required patient details (ask user for confirmation before submitting).",
            "Review the booking summary.",
            "Confirm the appointment (requires user approval).",
            "Capture the confirmation details.",
        ],
        sensitive_actions=["form_submit", "login"],
    ),
    "read_report": NavigatorTemplate(
        template_id="read_report",
        name="Read Medical Report",
        description="Navigate to a health portal, find a medical report, and summarise it.",
        start_url="https://www.nhs.uk/nhs-services/online-services/nhs-app/",
        estimated_steps=5,
        step_hints=[
            "Navigate to the health portal.",
            "Log in if required (ask user for credentials — require confirmation).",
            "Find the medical reports or test results section.",
            "Read the report content.",
            "Summarise the key findings in simple, non-medical language.",
        ],
        sensitive_actions=["login", "download"],
    ),
    "fill_form": NavigatorTemplate(
        template_id="fill_form",
        name="Fill Out a Form",
        description="Help the user fill out an online form step by step.",
        start_url="",  # User provides the URL
        estimated_steps=6,
        step_hints=[
            "Navigate to the form page.",
            "Read the form fields and explain what information is needed.",
            "Fill in each field with user-provided information.",
            "Review all entered data with the user.",
            "Submit the form (requires user approval).",
            "Capture any confirmation or reference numbers.",
        ],
        sensitive_actions=["form_submit", "login", "payment"],
    ),
}


def get_template(template_id: str) -> NavigatorTemplate | None:
    """Get a navigation template by ID."""
    return TEMPLATES.get(template_id)


def get_all_templates() -> list[dict]:
    """List all available templates (for frontend display)."""
    return [
        {
            "templateId": t.template_id,
            "name": t.name,
            "description": t.description,
            "estimatedSteps": t.estimated_steps,
        }
        for t in TEMPLATES.values()
    ]
