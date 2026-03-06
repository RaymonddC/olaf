"""OLAF agent system instructions."""

from .coordinator import COORDINATOR_INSTRUCTION
from .storyteller import STORYTELLER_INSTRUCTION
from .navigator import NAVIGATOR_INSTRUCTION
from .alert import ALERT_INSTRUCTION

__all__ = [
    "COORDINATOR_INSTRUCTION",
    "STORYTELLER_INSTRUCTION",
    "NAVIGATOR_INSTRUCTION",
    "ALERT_INSTRUCTION",
]
