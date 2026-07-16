# Vire — Reglas para Agentes de IA

Lee `docs/context.md` antes de cualquier cambio — ahí están arquitectura, decisiones de diseño, tokens, IPC, y findings técnicos.
No modifiques `docs/context.md` — es un snapshot del vault de Obsidian, los cambios de diseño se discuten ahí.

## npm / lockfile — Node version pitfall (recurrente)

Este repo fija `engines.node >= 24.18.0` en `package.json` y `.nvmrc = 24.18.0` — CI usa esa
versión exacta. Si corres `npm install <pkg>` o `npm install --package-lock-only` con **otra**
versión de Node activa (p. ej. 24.11.1 vía fnm/nvm), npm resuelve las dependencias opcionales
de WASM (`@emnapi/core`, `@emnapi/runtime`, usadas por `@napi-rs/wasm-runtime` y
`@rolldown/binding-wasm32-wasi`) de forma distinta y puede **eliminar sus entradas top-level**
del lockfile. El síntoma en CI es `npm ci` fallando con `EUSAGE` ("`npm ci` can only install
packages when your package.json and package-lock.json ... are in sync") — ya pasó dos veces
(commits `8447b8a`, `9158f3d`, y de nuevo tras agregar `@tauri-apps/plugin-notification`).

**Antes de cualquier `npm install`/`npm install --package-lock-only` en este repo:**
```
fnm use 24.18.0   # o: nvm use 24.18.0 — debe imprimir v24.18.0
```
y verificar después con `rm -rf node_modules && npm ci` (limpio, sin warnings de EUSAGE) antes
de dar el cambio por terminado. `npm ci --dry-run` NO detecta este problema de forma confiable.

## graphify

Este proyecto tiene un grafo de conocimiento en `graphify-out/` (grafo del código: nodos, comunidades, relaciones cross-file).

Reglas:
- Antes de leer o modificar código, corre `graphify query "<pregunta>"` cuando exista `graphify-out/graph.json` — devuelve un subgrafo acotado, normalmente mucho más chico que leer archivos crudos o grep.
- Usa `graphify path "<A>" "<B>"` para relaciones entre dos símbolos/archivos, y `graphify explain "<concepto>"` para un resumen enfocado de un nodo.
- Si existe `graphify-out/wiki/index.md`, úsalo para navegación amplia en vez de explorar el código a mano.
- Lee `graphify-out/GRAPH_REPORT.md` solo para revisión de arquitectura general o cuando query/path/explain no den suficiente contexto.
- Después de modificar código, corre `graphify update .` para mantener el grafo al día (solo AST, sin costo de API).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
