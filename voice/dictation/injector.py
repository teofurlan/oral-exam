"""Text injection: copies cleaned text to clipboard and simulates paste without pressing Enter."""
import time
from pynput.keyboard import Controller, Key
import pyperclip


class TextInjector:
    """Injects text into the active window by setting clipboard and triggering Ctrl+V."""

    def __init__(self, keyboard_controller: Controller | None = None, simulate_paste: bool = True):
        self._controller = keyboard_controller
        self.simulate_paste = simulate_paste

    @property
    def controller(self) -> Controller:
        if self._controller is None:
            self._controller = Controller()
        return self._controller

    def inject(self, text: str) -> bool:
        """Copy text to clipboard and optionally simulate Ctrl+V.

        NEVER simulates Enter, allowing the user to review before submitting.
        """
        if not isinstance(text, str) or not text.strip():
            return False

        clean_text = text.strip()

        try:
            pyperclip.copy(clean_text)
        except Exception:
            return False

        if not self.simulate_paste:
            return True

        try:
            # Small brief pause to allow clipboard buffer to register
            time.sleep(0.04)
            ctrl = self.controller
            # Simulate Ctrl + V
            with ctrl.pressed(Key.ctrl):
                ctrl.press("v")
                ctrl.release("v")
            return True
        except Exception:
            # Clipboard copy still succeeded; return True as text is available to paste manually
            return True
