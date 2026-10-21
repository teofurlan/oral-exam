"""Build a fully local, dependency-free listening index from measured results."""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parent / "comparison"
report = json.loads((ROOT / "results.json").read_text(encoding="utf-8"))
rows = []
for number, sample in enumerate(report["samples"], 1):
    if number == 9:
        rows.append('</ol><h2>Pronunciación técnica: primera prueba</h2><p>Las muestras 09 y 10 se conservan como referencia. La 10 sustituye algunos términos por explicaciones en español; no representa tu preferencia actual. Las nuevas 11–13 conservan README y usan fonemas ingleses para ese término.</p><ol start="9">')
    if number == 11:
        rows.append('</ol><h2 id="alex-dora-english">Alex + Dora: 15%, 20% y 25%</h2><p>Las tres leen el mismo texto, a velocidad 1.00. Solo cambia la proporción de Dora. README permanece en el texto y se sintetiza con fonemas ingleses; el resto usa fonemas españoles. Escucha si la pronunciación te resulta natural: no se garantiza un acento nativo.</p><ol start="11">')
    label = escape(sample["label"])
    source = escape(sample["file"], quote=True)
    rows.append(f'''<li>
      <h3>{label}</h3>
      <p class="parameters">Velocidad {sample['speed']:.2f} · {sample['duration_seconds']:.1f} segundos</p>
      <audio controls preload="metadata" src="{source}" aria-label="Escuchar muestra {number}: {label}"></audio>
      <a href="{source}" download>Descargar WAV {number:02d}</a>
      <details><summary>Texto que se lee</summary><p>{escape(sample['text'])}</p></details>
    </li>''')

page = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comparativa de voces Kokoro</title>
<style>
:root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.55; overflow-wrap: anywhere; }
* { box-sizing: border-box; }
body { width: 100%; max-width: 808px; margin: 0 auto; padding: 24px; }
h1 { font-size: 2rem; line-height: 1.2; margin-bottom: 16px; }
h2 { font-size: 1.4rem; margin-top: 40px; margin-bottom: 12px; }
h3 { font-size: 1.1rem; margin: 0 0 6px; }
p { max-width: 70ch; }
a { text-underline-offset: 0.2em; }
a:focus-visible, summary:focus-visible, audio:focus-visible { outline: 3px solid #3478db; outline-offset: 4px; }
ol { padding-left: 28px; }
li { padding: 20px 0; border-bottom: 1px solid #888; }
.parameters { font-variant-numeric: tabular-nums; margin: 0 0 12px; }
audio { display: block; width: 100%; min-width: 0; max-width: 520px; margin-bottom: 12px; }
details { margin-top: 12px; }
summary { cursor: pointer; }
footer { margin-top: 32px; }
@media (max-width: 480px) { body { padding: 16px; } h1 { font-size: 1.65rem; } }
</style>
</head>
<body>
<main>
<h1>Comparativa de voces Kokoro</h1>
<p>{{sample_count}} muestras locales para elegir por oído. Nada se reproduce automáticamente ni se envía a Internet. Al iniciar una muestra, la anterior se pausa.</p>
<p>Compara ahora <a href="#alex-dora-english"><strong>11, 12 y 13: Alex + Dora con README en inglés</strong></a>. La muestra 07 conserva tu mezcla favorita inicial. Dime los números que prefieres.</p>
<p><a href="comparison.m3u" download>Descargar lista de reproducción completa</a></p>
<h2>Timbre y ritmo: el mismo texto</h2>
<p>Las muestras 01–08 leen exactamente el mismo párrafo. Solo cambian las voces, sus proporciones o la velocidad. No se han aplicado ecualización ni efectos.</p>
<ol>
''' + '\n'.join(rows) + '''
</ol>
</main>
<footer><p>Son ejemplos sintéticos, no resultados de una revisión real. Generados con Kokoro local a 24 kHz. La mezcla puede cambiar el timbre, pero no garantiza mejorar la calidad.</p></footer>
<script>
const players = Array.from(document.querySelectorAll('audio'));
for (const player of players) {
  player.addEventListener('play', () => {
    for (const other of players) {
      if (other !== player) other.pause();
    }
  });
}
</script>
</body>
</html>
'''
page = page.replace("{{sample_count}}", str(len(report["samples"])))
(ROOT / "index.html").write_text(page, encoding="utf-8")
print(f"PASS: built comparison/index.html with {len(report['samples'])} manual audio players and local downloads.")
