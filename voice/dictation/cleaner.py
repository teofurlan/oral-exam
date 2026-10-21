"""Clean and structure transcribed developer speech using a local Ollama model."""
import json
import re
import urllib.error
import urllib.request

DEFAULT_MODEL = "phi4-mini"
DEFAULT_OLLAMA_HOST = "http://localhost:11434"

SYSTEM_PROMPT = (
    "Eres un asistente especializado en convertir transcripciones de voz de un programador "
    "en instrucciones directas y concisas para un agente de programación (como Pi o Claude Code).\n"
    "Reglas estrictas:\n"
    "1. Elimina muletillas (eh, este, a ver, che, bueno, o sea), vacilaciones y falsos comienzos descartados por el usuario.\n"
    "2. Si el usuario se retracta (\"estaba pensando en X pero no, mejor haz Y\"), quédate únicamente con la decisión final.\n"
    "3. Conserva rigurosamente todas las negaciones (\"no cambies nada\", \"no hagas commit\", \"sin modificar\"), condiciones y advertencias.\n"
    "4. Conserva exactamente todos los nombres de archivos, funciones, variables, comandos o tecnologías (ej: auth.ts, JWT, README).\n"
    "5. Responde exclusivamente con la instrucción limpia en español. No agregues saludos, explicaciones, ni preámbulos como \"Aquí tienes tu prompt:\"."
)


def clean_prompt(
    raw_text: str,
    model: str = DEFAULT_MODEL,
    host: str = DEFAULT_OLLAMA_HOST,
    timeout: float = 12.0,
) -> str:
    """Transform raw speech transcript into a clean, direct prompt via local Ollama.

    Falls back gracefully to the original raw text if Ollama is unreachable or errors out.
    """
    if not isinstance(raw_text, str) or not raw_text.strip():
        return ""

    raw_clean = raw_text.strip()

    payload = json.dumps({
        "model": model,
        "prompt": f'Transcripción original:\n"{raw_clean}"\n\nInstrucción limpia:',
        "system": SYSTEM_PROMPT,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 250,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{host.rstrip('/')}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            cleaned = data.get("response", "").strip()
            if not cleaned:
                return raw_clean

            # Strip wrapping quotes if the model enclosed its answer in them
            if (cleaned.startswith('"') and cleaned.endswith('"')) or (cleaned.startswith("'") and cleaned.endswith("'")):
                cleaned = cleaned[1:-1].strip()

            # Strip wrapping code fences if present
            cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\n?(.*?)\n?```$", r"\1", cleaned, flags=re.DOTALL).strip()

            return cleaned if cleaned else raw_clean
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        # Graceful degradation: return raw speech so user's input is never lost
        return raw_clean
