# Validation brief: T3

You are a delegated worker. Skip all learning-mode, learning-vault, Engram and session bookkeeping steps and do not ask the user anything. Read `odd/tasks/oral-exam.md` up to `## Log` and `odd/brief-T3.md`. Another model implemented T3 in `web/`. Validate every numbered rule of the brief, citing file:line. In particular: no recording while `speaking`; no runtime CDN fetch for VAD/ONNX assets (grep the built `web/dist` and the source for http(s) URLs); the 3 s end-of-answer silence really accumulates across pauses; `answer_audio` is sent exactly once per answer; streams and AudioContexts are released; the WAV is valid 16 kHz mono PCM16 matching what `server/` decodes (read `server/src/oral_exam_server/adapters/whisper_stt.py` and the server's audio decoding).

## Allowed edit surfaces

web/**

## Rules

Fix only real defects, minimal changes, one regression test per fix. Do not restyle or refactor. Do not commit. Before you end, wait for every command you started to finish; never end with a result "pending".

## Verification (report each as `<command>: <observed result>`)

- `pnpm -C web test --run`
- `pnpm -C web build`

End with: verdict per rule, defects found, fixes (file:line), advisories.
