"""CARIA — Playwright headless browser service.

Manages Chromium browser instances for the NavigatorAgent.
Provides page navigation, interaction, and screenshot capture.
"""

import asyncio
import base64
import logging
from contextlib import asynccontextmanager
from typing import Optional

from playwright.async_api import Browser, BrowserContext, Page, async_playwright, Playwright

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

MAX_CONCURRENT_SESSIONS = 5
VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 720
PAGE_LOAD_TIMEOUT_MS = 60_000
SCREENSHOT_QUALITY = 80  # JPEG quality (0-100)
DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000


class BrowserSession:
    """A single headless browser session tied to a navigation task."""

    def __init__(self, session_id: str, context: BrowserContext, page: Page):
        self.session_id = session_id
        self.context = context
        self.page = page
        self._closed = False

    @property
    def current_url(self) -> str:
        return self.page.url if not self._closed else ""

    @property
    def is_closed(self) -> bool:
        return self._closed

    async def navigate(self, url: str) -> dict:
        """Navigate to a URL and return page info + screenshot."""
        try:
            await self.page.goto(
                url,
                timeout=PAGE_LOAD_TIMEOUT_MS,
                wait_until="domcontentloaded",
            )
            screenshot = await self.capture_screenshot()
            return {
                "status": "success",
                "pageUrl": self.page.url,
                "pageTitle": await self.page.title(),
                "imageBase64": screenshot,
            }
        except Exception as exc:
            logger.error("Navigation to %s failed: %s", url, exc)
            return {
                "status": "error",
                "error_message": f"Could not load the page: {exc}",
            }

    async def click(self, selector: str) -> dict:
        """Click an element by CSS selector or text content."""
        try:
            # Try CSS selector first, fall back to text-based selector
            locator = self.page.locator(selector).first
            await locator.click(timeout=10_000)
            await self.page.wait_for_load_state("domcontentloaded", timeout=10_000)
            screenshot = await self.capture_screenshot()
            return {
                "status": "success",
                "pageUrl": self.page.url,
                "pageTitle": await self.page.title(),
                "imageBase64": screenshot,
            }
        except Exception as exc:
            logger.error("Click on '%s' failed: %s", selector, exc)
            return {
                "status": "error",
                "error_message": f"Could not click the element: {exc}",
            }

    async def type_into(self, selector: str, text: str) -> dict:
        """Type text into a form field."""
        try:
            locator = self.page.locator(selector).first
            await locator.fill(text, timeout=10_000)
            screenshot = await self.capture_screenshot()
            return {
                "status": "success",
                "pageUrl": self.page.url,
                "imageBase64": screenshot,
            }
        except Exception as exc:
            logger.error("Type into '%s' failed: %s", selector, exc)
            return {
                "status": "error",
                "error_message": f"Could not type into the field: {exc}",
            }

    async def scroll(self, direction: str, amount: int = 500) -> dict:
        """Scroll the page up or down."""
        try:
            delta = amount if direction == "down" else -amount
            await self.page.mouse.wheel(0, delta)
            # Brief pause for scroll animation / lazy-loaded content
            await asyncio.sleep(0.5)
            screenshot = await self.capture_screenshot()
            return {
                "status": "success",
                "pageUrl": self.page.url,
                "imageBase64": screenshot,
            }
        except Exception as exc:
            logger.error("Scroll %s failed: %s", direction, exc)
            return {
                "status": "error",
                "error_message": f"Could not scroll the page: {exc}",
            }

    async def capture_screenshot(self) -> str:
        """Capture a JPEG screenshot and return as base64 string."""
        try:
            raw = await self.page.screenshot(
                type="jpeg",
                quality=SCREENSHOT_QUALITY,
                full_page=False,
            )
            return base64.b64encode(raw).decode("ascii")
        except Exception as exc:
            logger.error("Screenshot capture failed: %s", exc)
            return ""

    async def read_text(self) -> str:
        """Extract all visible text from the current page."""
        try:
            return await self.page.inner_text("body", timeout=10_000)
        except Exception as exc:
            logger.error("Read page text failed: %s", exc)
            return f"Could not extract page text: {exc}"

    async def close(self) -> None:
        """Close the browser context and release resources."""
        if self._closed:
            return
        self._closed = True
        try:
            await self.context.close()
        except Exception as exc:
            logger.warning("Error closing browser session %s: %s", self.session_id, exc)


class BrowserService:
    """Manages a pool of headless Chromium browser sessions.

    Usage:
        service = BrowserService()
        await service.start()
        session = await service.create_session("sess-123")
        ...
        await service.close_session("sess-123")
        await service.stop()
    """

    def __init__(self) -> None:
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._sessions: dict[str, BrowserSession] = {}
        self._lock = asyncio.Lock()

    @property
    def active_session_count(self) -> int:
        return len(self._sessions)

    async def start(self) -> None:
        """Launch the Playwright engine and Chromium browser."""
        if self._browser is not None:
            return
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",  # Cloud Run /dev/shm workaround
                "--disable-setuid-sandbox",
            ],
        )
        logger.info("BrowserService started — Chromium launched")

    async def stop(self) -> None:
        """Close all sessions and shut down the browser."""
        async with self._lock:
            for session in list(self._sessions.values()):
                await session.close()
            self._sessions.clear()

        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        logger.info("BrowserService stopped")

    async def create_session(self, session_id: str) -> BrowserSession:
        """Create a new browser session (tab) with its own context."""
        async with self._lock:
            if len(self._sessions) >= MAX_CONCURRENT_SESSIONS:
                raise RuntimeError(
                    f"Maximum concurrent sessions ({MAX_CONCURRENT_SESSIONS}) reached"
                )
            if session_id in self._sessions:
                raise ValueError(f"Session {session_id} already exists")

        if not self._browser:
            await self.start()
        assert self._browser is not None

        context = await self._browser.new_context(
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        context.set_default_navigation_timeout(DEFAULT_NAVIGATION_TIMEOUT_MS)
        page = await context.new_page()

        session = BrowserSession(session_id, context, page)
        async with self._lock:
            self._sessions[session_id] = session

        logger.info("Browser session %s created", session_id)
        return session

    def get_session(self, session_id: str) -> Optional[BrowserSession]:
        """Get an active browser session by ID."""
        return self._sessions.get(session_id)

    async def close_session(self, session_id: str) -> None:
        """Close and remove a browser session."""
        async with self._lock:
            session = self._sessions.pop(session_id, None)
        if session:
            await session.close()
            logger.info("Browser session %s closed", session_id)


# ── Singleton ────────────────────────────────────────────────────────────────

_browser_service: Optional[BrowserService] = None


def get_browser_service() -> BrowserService:
    """Get or create the global BrowserService singleton."""
    global _browser_service
    if _browser_service is None:
        _browser_service = BrowserService()
    return _browser_service
