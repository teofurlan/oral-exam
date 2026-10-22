"""Manual real Pi run through the adapter; intentionally excluded from pytest collection.

Uses the installed Pi with the user's own settings and extensions, in a fresh
temporary folder, and costs a few cents of model tokens. Run from the repository root:
    uv run --project server python server/tests/smoke_pi_agent.py [provider/model]
"""
from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path
from time import perf_counter

from socra_server.adapters.pi_agent import PiBackend
from socra_server.domain.agent import PermissionRequest

# Pass the provider explicitly: Pi's own default provider may be on a quota the user needs elsewhere.
DEFAULT_MODEL = "antigravity/gemini-3.8-flash"


async def deny(request: PermissionRequest) -> bool:
    print(f"  permission asked: {request}")
    return False


async def turn(conversation, text: str, interrupt_after_s: float | None = None) -> None:
    print(f"> {text}")
    started = perf_counter()
    interrupter = None
    if interrupt_after_s is not None:
        async def interrupt_later() -> None:
            await asyncio.sleep(interrupt_after_s)
            print("  (interrupting)")
            await conversation.interrupt()
        interrupter = asyncio.create_task(interrupt_later())
    async for event in conversation.send(text):
        print(f"  {perf_counter() - started:5.1f}s {event}")
    if interrupter is not None:
        await interrupter


async def main(model: str) -> None:
    backend = PiBackend()
    started = perf_counter()
    status = await backend.check()
    models = backend.models()
    print(f"check: {status} in {perf_counter() - started:.1f}s; {len(models)} models, first {models[:2]}")
    started = perf_counter()
    if backend.model_refresh is not None:
        await backend.model_refresh
    providers = sorted({m.id.split("/", 1)[0] for m in backend.models()})
    print(f"refresh with extensions: {len(backend.models())} models after {perf_counter() - started:.1f}s; {providers}")
    with tempfile.TemporaryDirectory(prefix="socra-pi-smoke-") as folder:
        cwd = Path(folder)
        (cwd / "note.txt").write_text("hello\n", encoding="utf-8")
        (cwd / "junk").mkdir()
        started = perf_counter()
        conversation = await backend.open(model, cwd, deny)
        print(f"open: {model} in {cwd} after {perf_counter() - started:.1f}s")
        try:
            await turn(conversation, "Use the read tool to read note.txt, then reply with its single word only.")
            await turn(conversation, "Run exactly this bash command once and nothing else: rm -rf junk")
            print(f"  junk still exists: {(cwd / 'junk').exists()}")
            await turn(conversation, "Use bash to run: sleep 30 && echo done. Then reply done.", interrupt_after_s=6)
            await turn(conversation, "Reply with the single word OK.")
        finally:
            await conversation.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL))
