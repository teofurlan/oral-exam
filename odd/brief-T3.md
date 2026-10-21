# Brief: T3 — browser microphone capture (auto VAD + push-to-talk)

You are a delegated worker. Skip all learning-mode, learning-vault, Engram and session bookkeeping steps and do not ask the user anything. Read `odd/tasks/oral-exam.md` up to `## Log` first. You implement T3 only (S3, S4). All code, comments and UI copy in English. The server side (`server/`) is done: it expects `{"type":"answer_audio","format":"wav","data":"<base64>"}` while the turn state is `listening`, and answers with a final `transcript`. Do not edit `server/`.

## Allowed edit surfaces

web/**

## Rules (S3)

1. Capture only while the server state is `listening`. Never record while `speaking` (the page's own TTS would be captured). Request the mic with `echoCancellation`, `noiseSuppression`, `autoGainControl` true. Ask for mic permission on first use; show a clear, visible error if it is denied or no device exists.
2. **Auto mode (default):** voice activity detection with `@ricky0123/vad-web` (Silero). All its model/worklet/onnxruntime-web WASM assets must be served locally by Vite (copy them into the build, e.g. with `vite-plugin-static-copy`, and point `baseAssetPath`/`onnxWASMBasePath` at them). No CDN at runtime: the app must work offline. Exam answers contain thinking pauses, so do NOT end the answer on the first VAD speech end: accumulate speech segments and finalize only after an end-of-answer silence (default 3 s, configurable in the settings next to the mode toggle, persisted in localStorage with try/catch). Show a visible countdown/indicator while that silence timer runs, and let any new speech cancel it.
3. **Push-to-talk:** record while the hold button or Space is held (reuse the existing `PushToTalkControl`); on release, finalize. A hold shorter than 300 ms is ignored.
4. Finalize = encode the captured audio as 16 kHz mono PCM16 WAV, base64, send `answer_audio` once, then stop capturing until the server sets `listening` again (for example after `reanswer`). Empty or speech-free captures are not sent.
5. Feed the live mic level to the Orb's input volume while listening (read the Orb's real props in `web/src/components/ui/orb.tsx`).
6. Release the mic stream and audio nodes when leaving `listening`, on mode change and on unmount.
7. Keep audio logic in hooks/pure modules (`lib/wav.ts`, `hooks/useMicCapture.ts`, an answer-segmenter state machine) separate from presentational components.

## Tests (Vitest, through public interfaces; mock `getUserMedia` and the VAD module)

One test per rule: WAV encoder (header fields, 16 kHz resample, PCM16 clamping); segmenter (pause shorter than the silence keeps accumulating, new speech cancels the timer, silence finalizes once); no capture while `speaking`; push-to-talk sends on release and ignores < 300 ms; empty capture not sent; stream tracks stopped on leaving `listening`; permission-denied error rendered; silence setting persists. Keep existing tests green.

## Verification (report each as `<command>: <observed result>`)

- `pnpm -C web install`
- `pnpm -C web test --run`
- `pnpm -C web build` and confirm the VAD/ONNX assets are inside `web/dist` (list them).

Do not commit. At the end, list created/changed files and which S# you covered.
