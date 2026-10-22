"""Browser regression for #21 (requires Chrome).

Run: uv run --with playwright python web/tests/test_prompt_focus.py
Uses isolated pages, without the Socra server or a microphone.
"""

from pathlib import Path
import unittest

from playwright.sync_api import sync_playwright


SRC = Path(__file__).resolve().parents[1] / "src"
# Keep the real cascade layers and global focus rule; omit external imports.
GLOBAL_CSS = "\n".join(
    line for line in (SRC / "index.css").read_text(encoding="utf-8").splitlines()
    if not line.startswith("@import")
)
SHELL_CSS = (SRC / "App.css").read_text(encoding="utf-8")
HTML = """
<form class="composer">
  <input aria-label="Message" class="outline-none">
  <button type="submit" class="key" data-tone="primary">Send</button>
</form>
<input aria-label="Other field">
<button>Other control</button>
"""


class PromptFocusTest(unittest.TestCase):
    def test_keyboard_focus_in_both_themes_sizes_and_stylesheet_orders(self):
        with sync_playwright() as playwright:
            with playwright.chromium.launch(channel="chrome") as browser:
                for theme in ("dark", "light"):
                    for width in (390, 1440):
                        for styles in ((GLOBAL_CSS, SHELL_CSS), (SHELL_CSS, GLOBAL_CSS)):
                            with self.subTest(theme=theme, width=width, global_first=styles[0] == GLOBAL_CSS):
                                page = browser.new_page(viewport={"width": width, "height": 900})
                                try:
                                    page.set_content(
                                        f'<html data-theme="{theme}"><head><style>'
                                        '@layer utilities { .outline-none { outline-style: none; } }'
                                        + "\n".join(styles) + "</style></head><body>" + HTML + "</body></html>"
                                    )
                                    page.keyboard.press("Tab")
                                    self.assertEqual(page.locator(":focus").get_attribute("aria-label"), "Message")
                                    self.assertEqual(page.locator(".composer input").evaluate(
                                        "el => getComputedStyle(el).outlineStyle"
                                    ), "none")
                                    page.wait_for_function("""() => {
                                        const el = document.querySelector('.composer');
                                        return getComputedStyle(el).borderColor ===
                                            getComputedStyle(el).getPropertyValue('--accent').trim() ||
                                            el.getAnimations().every(animation => animation.playState === 'finished');
                                    }""")
                                    self.assertTrue(page.locator(".composer").evaluate("""el => {
                                        const style = getComputedStyle(el);
                                        const reference = document.createElement('span');
                                        reference.style.color = 'var(--accent)';
                                        el.append(reference);
                                        const accent = getComputedStyle(reference).color;
                                        reference.remove();
                                        return style.borderColor === accent &&
                                            parseFloat(style.borderWidth) > 0 &&
                                            parseFloat(style.borderRadius) > 0;
                                    }"""))
                                    for _ in range(3):
                                        page.keyboard.press("Tab")
                                        self.assertEqual(page.locator(":focus").evaluate(
                                            "el => getComputedStyle(el).outlineStyle"
                                        ), "solid")
                                        self.assertEqual(page.locator(":focus").evaluate(
                                            "el => getComputedStyle(el).outlineWidth"
                                        ), "2px")
                                finally:
                                    page.close()


if __name__ == "__main__":
    unittest.main()
