# Vire — Plan de Mejora (Fase 6+)

> Basado en análisis de gap contra **Orca** (github.com/stablyai/orca — "ADE for a fleet of
> parallel agents", Electron, 14k★) y **Deska** (deska.dev) como apoyo de idea, siguiendo el
> objetivo: *central hub / AI orchestrator para desarrolladores que usan coding agents,
> multiplataforma (Mac/Windows/Linux)*.
>
> Estado Vire hoy (Fase 5 ✅): canvas infinito con 7 bloques (Terminal, Agent, Editor,
> Pomodoro, TaskList, Browser, Note), Tauri v2 + Rust, vt100+portable-pty con sesiones
> persistentes y reattach, SQLite (proyectos/boards/config/terminales), CI/CD en GitHub Actions.

---

## 1. Qué hace Orca (referencia principal)

- **Unidad de navegación = worktree, no archivo.** Sidebar con tarjetas de worktree: rama,
  estado del agente (`working` / `awaiting input`), tiempo transcurrido. Un prompt puede
  abanicarse a N agentes en paralelo, cada uno en su git worktree aislado; se comparan salidas
  y se mergea el ganador.
- **~29 agentes CLI soportados** (Claude Code, Codex, OpenCode, Cursor, Copilot, Goose, etc.)
  con modelo BYO-subscription.
- **Terminal "Ghostty-class"**: xterm.js+WebGL, splits infinitos, scrollback persistente entre
  reinicios, búsqueda en terminal, tabs con Cmd+J.
- **Source control panel**: tree view persistido, generación IA de mensajes de commit, diff
  viewer, y el patrón estrella: **comentarios inline sobre el diff que se envían al agente
  como feedback** (loop review→prompt).
- **Notificaciones**: estado binario working/awaiting-input como primitiva; unread markers en
  worktrees/tabs cuando un agente termina sin foco; push a app móvil companion.
- **Quick open** (Cmd+K) que busca worktrees + archivos + agentes + comandos en una paleta.
- **Integraciones**: GitHub PRs/issues → botón "abrir worktree con agente"; Linear; Design Mode
  (click en elemento del browser embebido → HTML/CSS/screenshot al prompt); SSH worktrees
  remotos; CLI propio (`orca worktree create`, `snapshot`) para que los agentes automaticen a
  Orca mismo.
- **Dolores conocidos** (482 issues): fiabilidad remota/SSH, sync de file-watch, lifecycle de
  agentes (cerrar tab no mata sesión), herencia de env vars, submodules en source control.

## 2. Análisis de gap (objetivo vs. Vire actual)

| Feature objetivo | Vire hoy | Gap |
|---|---|---|
| Multi-proyecto simultáneo | Tabs de proyecto en topbar, 1 board por proyecto | Sin worktrees, sin estado git |
| Git worktrees por tarea | ❌ | Crear/listar/borrar worktrees; board por worktree |
| Terminal multi-tab / splits | 1 PTY por bloque Terminal | Tabs dentro del bloque; "splits" ya existen como bloques múltiples en canvas |
| Agentes aislados por tarea | Bloque Agent + terminales sueltos | Sin vínculo agente↔worktree, sin estado working/awaiting |
| Notificaciones + unread | ❌ | Detección de actividad PTY/agente, badges en tabs y bloques |
| Editor integrado | Monaco mono-archivo | Sin file tree, sin multi-archivo |
| Búsqueda | ❌ | Quick open (archivos + bloques + comandos) |
| Source control tab | ❌ | Status/diff/stage/commit por proyecto/worktree |

**Ventaja estructural de Vire sobre Orca:** el canvas infinito ya ES el "split infinito" —
bloques heterogéneos (terminal, agente, editor, browser, notas) conviven espacialmente sin
gestor de tiling. Y Tauri/Rust da binarios ~10x más livianos que Electron. La estrategia no es
clonar Orca sino portar sus primitivas de orquestación al modelo canvas.

## 3. Mejoras clave propuestas

### 3.1 Worktrees como primitiva (el corazón de Orca)
- Backend Rust: módulo `git/` con `git2` crate (o shell-out a `git` CLI — más simple, menos
  binario) — comandos `list_worktrees`, `create_worktree(branch)`, `remove_worktree` con
  preflight (cambios sin commitear → confirmar).
- Modelo: `VireProject` gana `repo_path` opcional; un worktree = sub-entrada del proyecto con
  su propio board. Topbar: tab de proyecto → dropdown/segunda fila de worktrees.
- Al crear worktree: opción "abrir con agente" — spawna bloque Agent/Terminal con cwd en el
  worktree y prompt inicial.

### 3.2 Estado de agente + notificaciones unread (estilo Gmail)
- Primitiva binaria de Orca: `working` / `awaiting input` / `idle`. En Rust, ProcessManager ya
  tiene el stream de output — detectar: output fluye = working; prompt detectado/sin output
  tras input = awaiting; proceso muerto = done.
- Para bloque Agent (stream JSON de claude/opencode): estados exactos del protocolo
  (tool use, waiting for permission, finished).
- UI: dot ámbar pulsante en bloque activo; **badge unread en tab de proyecto** cuando un
  agente/terminal termina o pide input y el proyecto no está enfocado; contador estilo Gmail.
- Notificaciones nativas OS via `tauri-plugin-notification` (click → enfoca proyecto+bloque).
- Panel "inbox": lista cronológica de eventos (agente X terminó en worktree Y) con marcar-leído.

**Estado (2026-07-11), implementado en Fase 8:** solo `working`/`done`/`idle` (derivados 100%
en frontend del byte-stream de terminal y de los eventos `Line`/`Done` del agente, sin nueva
primitiva en `ProcessManager`). `awaiting input` queda deliberadamente fuera — sin un protocolo
estructurado del lado del agente, distinguir "esperando input" de "output lento" en una PTY
genérica es frágil (falsos positivos/negativos). Se agrega cuando los agentes expongan un
stream estructurado (tool-use/waiting-for-permission), tal como ya prevé el punto anterior.

### 3.3 Terminal: tabs + búsqueda + scrollback persistente
- Tabs dentro del bloque Terminal (N sesiones PTY por bloque, header con tabs). Splits NO —
  el canvas ya lo resuelve; documentar ese patrón.
- Scrollback: hoy TermFrame es snapshot de grid — añadir ring buffer de líneas scrolled-out en
  Rust (vt100 `screen().scrollback`) + persistir últimas N líneas en SQLite para reattach.
- Búsqueda en terminal (Cmd+F dentro del bloque, sobre scrollback).

### 3.4 Source control block/tab
- Nuevo bloque `SourceControl`: status (staged/unstaged/untracked), diff viewer, stage por
  archivo, commit con mensaje. Comandos Rust: `git_status`, `git_diff`, `git_stage`,
  `git_commit` (shell-out).
- V2 (patrón estrella de Orca): comentario inline en línea de diff → botón "enviar a agente"
  que inyecta archivo+hunk+comentario como prompt al bloque Agent del mismo worktree.
- Generación IA de mensaje de commit usando el CLI de agente ya configurado.

### 3.5 Editor: file tree + multi-archivo
- Bloque Editor gana sidebar file-tree (read_dir recursivo lazy) + tabs de archivos abiertos.
- Autosave (patrón Orca: autosave everywhere).
- Drag de archivo desde tree → bloque Agent = adjuntar path al prompt.

### 3.6 Quick open / búsqueda global
- Paleta Cmd+K: fuzzy search sobre archivos del proyecto (walker en Rust, respeta .gitignore
  via `ignore` crate), bloques del canvas (saltar+centrar cámara), proyectos/worktrees,
  comandos (nuevo bloque, nuevo worktree…).
- Búsqueda de contenido (grep) V2: `grep` crate (ripgrep lib) con resultados que abren Editor.

### 3.7 Multi-agente ampliado
- Hoy: claude/opencode. Config declarativa de agentes (nombre, binario, args, formato stream)
  en tabla `configs` → soportar Codex, Gemini CLI, Goose, etc. sin código nuevo por agente
  (lección de Orca: el long-tail de agentes es demanda constante).
- Fan-out V2: un prompt → N worktrees con N agentes, comparar diffs lado a lado en canvas
  (el canvas es ideal para esto: N bloques diff en fila).

## 4. Roadmap propuesto

| Fase | Contenido | Por qué este orden |
|---|---|---|
| **6 — Git core** | Módulo git en Rust, bloque SourceControl (status/diff/stage/commit), repo_path en proyecto | Base de todo lo demás; valor inmediato standalone |
| **7 — Worktrees** | CRUD worktrees, board por worktree, UI en topbar, "abrir con agente" | Depende de 6; desbloquea paralelismo |
| **8 — Estados + notificaciones** | working/awaiting/done en ProcessManager y Agent, badges unread, notificaciones OS, inbox | El diferenciador de orquestación; depende de nada de 6-7 pero brilla con worktrees |
| **9 — Terminal pro** | Tabs por bloque, scrollback persistente, búsqueda | Independiente; mejora diaria |
| **10 — Editor + búsqueda** | File tree, multi-archivo, autosave, Cmd+K quick open | Independiente |
| **11 — Loop review→agente** | Comentarios en diff → prompt a agente, commit-msg IA, fan-out multi-agente | Corona: requiere 6+7+8 |

Criterio general: cada fase shippeable sola, sin big-bang. Evitar los dolores documentados de
Orca desde el diseño: matar sesión de agente al cerrar bloque (lifecycle explícito), heredar
env del shell del usuario (ya resuelto en Vire con TERM config), preflight antes de borrar
worktree.

## 5. Apoyo de idea: Deska (deska.dev)

**Hallazgo clave: Deska es el competidor directo de Vire** — canvas infinito zoomable por
proyecto ("como Figma/Miro pero para construir software"), paneles flotantes de editor,
terminal, browser, git, notas y agentes IA (Claude Code, Codex, OpenCode). Electron,
local-first, con companion móvil y voz. Pricing freemium con créditos ($0/$5/$29/$80/mes,
$500 lifetime con BYOK).

### Qué hace bien (patrones a adoptar)

- **Workspace overview board** (Cmd+Shift+P): cada workspace como tarjeta con mini-canvas en
  vivo, rama git actual, e indicador de agente corriendo; filtros Active/Agents-running/
  Dormant. El "hub" de multi-proyecto más logrado que existe hoy.
- **Agent session resume**: recuerda qué conversación de CLI (Claude Code/Codex/OpenCode…)
  corría en cada terminal y la retoma al reabrir el workspace — incluso varias en la misma
  carpeta. Vire ya tiene reattach de PTY; extenderlo a resume de sesión de agente es el paso
  natural (`claude --resume`).
- **Status strip de terminal**: cwd, rama git + dirty, pulso de actividad, badges de framework,
  puertos escuchando (click → browser). Denso y glanceable.
- **Smart action bar**: una sola sugerencia contextual sobre el output (abrir link, saltar a
  `file.ts:42`, comando siguiente, fix de error), Alt+Enter para aceptar. Nunca una lista
  ruidosa.
- **Link routing inteligente**: OAuth → browser del sistema (webviews embebidos rompen auth —
  dolor que Vire ya vivió con X-Frame-Options); localhost → panel Browser embebido.
- **Command Palette unificada**: comandos + archivos por nombre Y contenido + paneles abiertos
  + **scrollback de todas las terminales** + settings, en una caja; Tab la convierte en
  pregunta a agente.
- **Editor**: banner de cambio externo (reload vs keep) — crítico con agentes editando
  archivos; tabs preview vs pinned; format-on-save.
- **Tool-approval cards** inline en el hilo del agente + auto-approve por panel + chip honesto
  de tokens/costo/context-window.
- Notas anclables a paneles con línea conectora; time-scrubber de layout (undo espacial).

### Dónde Deska NO compite (oportunidad para Vire)

- **Sin git worktrees** — la palabra no aparece en todo su sitio/docs.
- **Sin unread markers ni inbox de notificaciones** — solo un toggle "avisar cuando el agente
  termine/pida input, opcionalmente solo si la ventana no tiene foco".
- **Sin review de cambios de agente** — su panel Git es básico (status/log/branches, diff
  read-only), sin PR, sin commit-msg IA, sin loop diff→agente.

**Conclusión de posicionamiento:** Orca tiene la orquestación (worktrees, estados, unread,
review-loop) pero no el canvas; Deska tiene el canvas pero no la orquestación. Vire ya tiene
el canvas con stack más liviano (Tauri vs Electron de ambos) — el plan de las secciones 3-4
(worktrees + estados + unread + source control con loop al agente) ataca exactamente el hueco
que ninguno de los dos cubre completo.

## 6. Refinamientos al roadmap desde Deska

Adiciones puntuales a las fases ya definidas (no cambian el orden):

- **Fase 8 (notificaciones)**: sumar patrón Deska de "alertar solo sin foco" como toggle; el
  inbox de Vire va más allá de ambos competidores.
- **Fase 9 (terminal pro)**: sumar status strip (rama+dirty+puertos) al header del bloque
  Terminal — barato, alto valor; y agent session resume (detectar CLI de agente corriendo en
  PTY, guardar session-id, reanudar con `--resume` al reattach).
- **Fase 10 (editor + búsqueda)**: banner de cambio externo en Editor (obligatorio con agentes
  escribiendo archivos); Cmd+K incluye scrollback de terminales como fuente de búsqueda.
- **Fase 11**: link routing OAuth-vs-localhost en terminal/browser.

### Anti-metas (explícitas, para no dispersarse)

- No companion móvil, no voz, no créditos/billing, no cloud — Vire es local-first puro.
- No splits de terminal tipo tiling — el canvas es el tiling.
- No marketplace de agentes — config declarativa basta.
