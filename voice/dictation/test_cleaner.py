"""Unit tests for the Ollama-based spoken prompt cleaner."""
import json
import unittest
from unittest.mock import MagicMock, patch

from cleaner import SYSTEM_PROMPT, clean_prompt


class CleanerUnitTests(unittest.TestCase):
    def test_empty_or_whitespace_returns_empty(self):
        self.assertEqual(clean_prompt(""), "")
        self.assertEqual(clean_prompt("   \n\t  "), "")

    @patch("urllib.request.urlopen")
    def test_clean_prompt_calls_ollama_and_returns_cleaned_text(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "response": "Revisa el archivo auth.ts. No toques nada todavía."
        }).encode("utf-8")
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        raw = "eh mira... estaba pensando en revisar auth.ts pero no toques nada todavia"
        result = clean_prompt(raw, model="phi4-mini")
        self.assertEqual(result, "Revisa el archivo auth.ts. No toques nada todavía.")

        # Verify request payload
        self.assertEqual(mock_urlopen.call_count, 1)
        req = mock_urlopen.call_args[0][0]
        payload = json.loads(req.data.decode("utf-8"))
        self.assertEqual(payload["model"], "phi4-mini")
        self.assertEqual(payload["system"], SYSTEM_PROMPT)
        self.assertIn(raw, payload["prompt"])

    @patch("urllib.request.urlopen")
    def test_fallback_to_raw_on_connection_error(self, mock_urlopen):
        mock_urlopen.side_effect = ConnectionRefusedError("Ollama is not running")
        raw = "revisa el archivo README.md"
        result = clean_prompt(raw)
        # Graceful degradation: returns raw text when Ollama is unreachable
        self.assertEqual(result, raw)

    @patch("urllib.request.urlopen")
    def test_fallback_to_raw_on_empty_or_invalid_response(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = b"{}"
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        raw = "haz un commit de lo que hay"
        result = clean_prompt(raw)
        self.assertEqual(result, raw)

    @patch("urllib.request.urlopen")
    def test_strips_unwanted_surrounding_quotes_and_markdown(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "response": '  "Explica la arquitectura del proyecto sin modificar nada."  '
        }).encode("utf-8")
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        result = clean_prompt("quiero que me expliques la arquitectura sin tocar nada")
        self.assertEqual(result, "Explica la arquitectura del proyecto sin modificar nada.")


if __name__ == "__main__":
    unittest.main()
