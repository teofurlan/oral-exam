"""Unit tests for the text injector (clipboard and paste simulation)."""
import unittest
from unittest.mock import MagicMock, call, patch

from injector import TextInjector


class InjectorUnitTests(unittest.TestCase):
    def test_empty_or_whitespace_text_returns_false(self):
        injector = TextInjector()
        self.assertFalse(injector.inject(""))
        self.assertFalse(injector.inject("   "))
        self.assertFalse(injector.inject(None))

    @patch("pyperclip.copy")
    def test_inject_copies_to_clipboard(self, mock_copy):
        injector = TextInjector(simulate_paste=False)
        success = injector.inject("Revisa auth.ts y no cambies nada.")
        self.assertTrue(success)
        mock_copy.assert_called_once_with("Revisa auth.ts y no cambies nada.")

    @patch("pyperclip.copy")
    def test_simulate_paste_triggers_ctrl_v_and_never_enter(self, mock_copy):
        mock_controller = MagicMock()
        injector = TextInjector(keyboard_controller=mock_controller, simulate_paste=True)

        success = injector.inject("Explica el flujo de login.")
        self.assertTrue(success)
        mock_copy.assert_called_once_with("Explica el flujo de login.")

        # Check key press calls
        pressed_keys = [c[0][0] for c in mock_controller.press.call_args_list]
        released_keys = [c[0][0] for c in mock_controller.release.call_args_list]

        # Verify Ctrl and 'v' were pressed and released
        self.assertIn("v", [str(k).lower() for k in pressed_keys])
        self.assertIn("v", [str(k).lower() for k in released_keys])

        # Verify Enter was NEVER pressed or released
        all_calls = mock_controller.method_calls
        for method_call in all_calls:
            for arg in method_call.args:
                arg_str = str(arg).lower()
                self.assertNotIn("enter", arg_str)
                self.assertNotIn("return", arg_str)


if __name__ == "__main__":
    unittest.main()
