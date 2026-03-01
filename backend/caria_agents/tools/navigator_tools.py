"""CARIA Navigator — ADK tool functions.

These tools control a headless Playwright browser for the Navigator agent.
Each tool represents a browser action the agent can perform.
"""

import logging
from typing import Optional

from google.adk.tools.tool_context import ToolContext

logger = logging.getLogger(__name__)


def _get_session(tool_context: ToolContext):
    """Retrieve the NavigatorSession from tool context state."""
    from services.navigator_session import get_session_manager

    session_id = tool_context.state.get("temp:session_id")
    if not session_id:
        return None
    return get_session_manager().get_session(session_id)


async def _send_screenshot_and_narration(
    session, result: dict, narration: str
) -> None:
    """Send screenshot + narration to the WebSocket client if connected."""
    if not session:
        return
    session.touch()
    session.step_count += 1

    image = result.get("imageBase64", "")
    if image:
        await session.send_screenshot(
            image_base64=image,
            page_url=result.get("pageUrl", ""),
            page_title=result.get("pageTitle", ""),
        )
    if narration:
        await session.send_narration(narration)


# ── Tool functions ───────────────────────────────────────────────────────────


async def navigate_to_url(
    url: str,
    tool_context: ToolContext,
) -> dict:
    """Navigate the browser to a URL.

    Args:
        url: The website URL to navigate to.

    Returns:
        dict with status, page title, current URL, and screenshot.
    """
    session = _get_session(tool_context)
    if not session:
        return {"status": "error", "error_message": "No active browser session."}

    logger.info("navigate_to_url: %s", url)
    tool_context.state["temp:current_url"] = url

    result = await session.browser_session.navigate(url)

    narration = (
        f"Opening {url}…"
        if result["status"] == "success"
        else f"Could not open {url}."
    )
    await _send_screenshot_and_narration(session, result, narration)
    return result


async def take_screenshot(
    tool_context: ToolContext,
) -> dict:
    """Capture a screenshot of the current browser page.

    Returns:
        dict with status, page URL, title, and base64 screenshot image.
    """
    session = _get_session(tool_context)
    if not session:
        return {"status": "error", "error_message": "No active browser session."}

    current_url = session.browser_session.current_url
    logger.info("take_screenshot at %s", current_url)

    image = await session.browser_session.capture_screenshot()
    page_title = await session.browser_session.page.title()

    result = {
        "status": "success",
        "pageUrl": current_url,
        "pageTitle": page_title,
        "imageBase64": image,
    }
    await _send_screenshot_and_narration(session, result, "Taking a screenshot of the page…")
    return result


async def click_element(
    selector: str,
    description: str,
    tool_context: ToolContext,
) -> dict:
    """Click an element on the page.

    Args:
        selector: CSS selector or accessible name of the element to click.
        description: Human-readable description of what is being clicked.

    Returns:
        dict with status, updated page info, and screenshot.
    """
    session = _get_session(tool_context)
    if not session:
        return {"status": "error", "error_message": "No active browser session."}

    logger.info("click_element: %s (%s)", selector, description)

    result = await session.browser_session.click(selector)
    narration = (
        f"Clicking on '{description}'…"
        if result["status"] == "success"
        else f"Could not click '{description}'."
    )
    await _send_screenshot_and_narration(session, result, narration)

    # Update URL state after navigation
    if result["status"] == "success":
        tool_context.state["temp:current_url"] = result.get("pageUrl", "")

    return result


async def type_text(
    selector: str,
    text: str,
    field_description: str,
    tool_context: ToolContext,
) -> dict:
    """Type text into a form field.

    Args:
        selector: CSS selector or accessible name of the input field.
        text: The text to type into the field.
        field_description: Human-readable description of the field.

    Returns:
        dict with status and screenshot.
    """
    session = _get_session(tool_context)
    if not session:
        return {"status": "error", "error_message": "No active browser session."}

    logger.info("type_text into %s: %s", field_description, "[redacted]")

    result = await session.browser_session.type_into(selector, text)
    narration = (
        f"Typing into '{field_description}'…"
        if result["status"] == "success"
        else f"Could not type into '{field_description}'."
    )
    await _send_screenshot_and_narration(session, result, narration)
    return result


async def scroll_page(
    direction: str,
    amount: int,
    tool_context: ToolContext,
) -> dict:
    """Scroll the page up or down.

    Args:
        direction: Scroll direction — 'up' or 'down'.
        amount: Number of pixels to scroll.

    Returns:
        dict with status and screenshot.
    """
    session = _get_session(tool_context)
    if not session:
        return {"status": "error", "error_message": "No active browser session."}

    logger.info("scroll_page: %s by %d", direction, amount)

    result = await session.browser_session.scroll(direction, amount)
    narration = f"Scrolling {direction}…"
    await _send_screenshot_and_narration(session, result, narration)
    return result


async def read_page_text(
    tool_context: ToolContext,
) -> dict:
    """Extract the main text content from the current page.

    Returns:
        dict with status and the extracted text content.
    """
    session = _get_session(tool_context)
    if not session:
        return {"status": "error", "error_message": "No active browser session."}

    current_url = session.browser_session.current_url
    logger.info("read_page_text at %s", current_url)

    text = await session.browser_session.read_text()
    await session.send_narration("Reading the page content…")
    session.touch()

    return {
        "status": "success",
        "pageUrl": current_url,
        "content": text[:5000],  # Limit to 5000 chars to avoid overwhelming the LLM
    }


async def summarize_content(
    content: str,
    purpose: str,
    tool_context: ToolContext,
) -> dict:
    """Summarise page content for the elderly user.

    Args:
        content: The text content to summarise.
        purpose: Why the user needs this summary (e.g. 'pension status check').

    Returns:
        dict with status and summary text.
    """
    session = _get_session(tool_context)
    logger.info("summarize_content for purpose: %s", purpose)

    if session:
        await session.send_narration(f"Summarising the content for you…")
        session.touch()

    # The LLM agent itself will generate the summary — this tool provides the raw text
    return {
        "status": "success",
        "summary": content[:3000],
        "purpose": purpose,
    }


async def ask_user_confirmation(
    action_description: str,
    action_type: str,
    tool_context: ToolContext,
) -> dict:
    """Request user confirmation for a sensitive action.

    Args:
        action_description: What the action will do (e.g. 'Submit the pension inquiry form').
        action_type: Type of action — 'form_submit', 'login', 'payment', or 'download'.

    Returns:
        dict with status and whether the user approved the action.
    """
    session = _get_session(tool_context)
    if not session:
        return {
            "status": "error",
            "error_message": "No active browser session for confirmation.",
        }

    logger.info("ask_user_confirmation: %s (%s)", action_description, action_type)

    # This blocks until the user responds via WebSocket
    result = await session.request_confirmation(action_description, action_type)

    approved = result.get("approved", False)
    action_id = result.get("action_id", "")

    logger.info(
        "Confirmation result: action=%s approved=%s",
        action_id, approved,
    )

    return {
        "status": "success",
        "action_id": action_id,
        "approved": approved,
        "message": "Action approved" if approved else "Action rejected by user",
    }
