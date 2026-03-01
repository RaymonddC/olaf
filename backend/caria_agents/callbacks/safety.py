"""Input safety callback for the CARIA coordinator.

Blocks harmful content before it reaches the LLM.
"""

import logging
from typing import Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse
from google.genai import types

logger = logging.getLogger(__name__)

BLOCKED_PATTERNS = [
    "ignore previous",
    "ignore all instructions",
    "jailbreak",
    "drop table",
    "system prompt",
    "reveal your instructions",
    "bypass safety",
]


def safety_before_model(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    """Block harmful or manipulative content before it reaches the LLM."""
    if not llm_request.contents:
        return None

    last_content = llm_request.contents[-1]
    if not last_content.parts:
        return None

    text = ""
    for part in last_content.parts:
        if hasattr(part, "text") and part.text:
            text += part.text

    text_lower = text.lower()
    for pattern in BLOCKED_PATTERNS:
        if pattern in text_lower:
            logger.warning("Blocked input matching pattern '%s'", pattern)
            return LlmResponse(
                content=types.Content(
                    role="model",
                    parts=[
                        types.Part(
                            text="I'm sorry, I can't help with that request. "
                            "Let me know if there's something else I can assist you with."
                        )
                    ],
                )
            )

    return None
