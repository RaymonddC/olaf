"""Navigation safety callback for the OLAF Navigator agent.

Validates URLs and actions before the NavigatorAgent executes them.
"""

import logging
from typing import Optional
from urllib.parse import urlparse

from google.adk.agents.callback_context import CallbackContext

logger = logging.getLogger(__name__)

# Domains that are explicitly blocked for safety
BLOCKED_DOMAINS = [
    "darkweb",
    "torproject",
    "gambling",
    "casino",
    "betting",
    "adult",
    "xxx",
]

# Only allow common protocols
ALLOWED_SCHEMES = {"http", "https"}


def validate_navigation_safety(
    callback_context: CallbackContext,
    tool_name: str,
    tool_args: dict,
) -> Optional[dict]:
    """Validate URLs and actions before NavigatorAgent executes them."""
    if tool_name == "navigate_to_url":
        url = tool_args.get("url", "")
        parsed = urlparse(url)

        # Check protocol
        if parsed.scheme and parsed.scheme not in ALLOWED_SCHEMES:
            logger.warning("Blocked navigation to non-HTTP URL: %s", url)
            return {
                "status": "error",
                "error_message": "Only HTTP and HTTPS websites are supported.",
            }

        # Check blocked domains
        domain = parsed.netloc.lower()
        for blocked in BLOCKED_DOMAINS:
            if blocked in domain:
                logger.warning("Blocked navigation to unsafe domain: %s", domain)
                return {
                    "status": "error",
                    "error_message": "This website is not allowed for safety reasons.",
                }

    # Log all interactions for audit trail
    if tool_name in ("click_element", "type_text", "navigate_to_url"):
        user_id = callback_context.state.get("user:user_id", "unknown")
        logger.info(
            "Navigator audit: user=%s action=%s args=%s",
            user_id, tool_name, {k: v for k, v in tool_args.items() if k != "text"},
        )

    return None
