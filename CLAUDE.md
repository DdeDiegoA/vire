# Vire — Reglas para Agentes de IA

Lee `docs/context.md` antes de cualquier cambio — ahí están arquitectura, decisiones de diseño, tokens, IPC, y findings técnicos.
No modifiques `docs/context.md` — es un snapshot del vault de Obsidian, los cambios de diseño se discuten ahí.

## graphify

Este proyecto tiene un grafo de conocimiento en `graphify-out/` (grafo del código: nodos, comunidades, relaciones cross-file).

Reglas:
- Antes de leer o modificar código, corre `graphify query "<pregunta>"` cuando exista `graphify-out/graph.json` — devuelve un subgrafo acotado, normalmente mucho más chico que leer archivos crudos o grep.
- Usa `graphify path "<A>" "<B>"` para relaciones entre dos símbolos/archivos, y `graphify explain "<concepto>"` para un resumen enfocado de un nodo.
- Si existe `graphify-out/wiki/index.md`, úsalo para navegación amplia en vez de explorar el código a mano.
- Lee `graphify-out/GRAPH_REPORT.md` solo para revisión de arquitectura general o cuando query/path/explain no den suficiente contexto.
- Después de modificar código, corre `graphify update .` para mantener el grafo al día (solo AST, sin costo de API).
