"""OLAF agent system instructions."""

from .alert import ALERT_INSTRUCTION
from .coordinator import COORDINATOR_INSTRUCTION
from .navigator import NAVIGATOR_INSTRUCTION
from .storyteller import STORYTELLER_INSTRUCTION

__all__ = [
    "COORDINATOR_INSTRUCTION",
    "STORYTELLER_INSTRUCTION",
    "NAVIGATOR_INSTRUCTION",
    "ALERT_INSTRUCTION",
]
