# Vire — Contexto de Proyecto

> ⚠️ **SNAPSHOT ACTUALIZADO** (2026-07-07). Refleja el estado actual del proyecto.
> Fuente original: vault Obsidian `Proyectos/vire/*.md`.
> No modificar manualmente — los cambios de diseño se discuten en el vault.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Rust (Tauri v2) |
| Frontend | React 19 + TypeScript + Vite |
| Canvas | Custom (React + HTML/CSS, pan/zoom manual, sin tldraw) |
| Terminal | vt100 + portable-pty (wezterm crate) |
| Estado | Zustand |
| Fonts | Inter (UI) + JetBrains Mono (terminal) |

## Arquitectura

```
Tauri Backend (Rust)
├── vt100 + portable-pty
│   ├── portable-pty (PTY master)
│   ├── vt100 (VT Parser + State)
│   └── TermFrame → grid de celdas
├── Process Manager (+ sink swappable para reattach)
├── Project Manager (SQLite)
└── Agent runner (spawn CLI, stream JSON)
        │
        ▼ Tauri Commands + Channels
        │
Tauri Frontend (React + custom canvas)
├── VireCanvas (custom, infinite, pan/zoom)
│   ├── Bloque Terminal (canvas 2D, vt100 render)
│   ├── Bloque Agent (chat con claude/opencode)
│   ├── Bloque Editor (Monaco)
│   ├── Bloque Note (textarea + markdown preview)
│   ├── Bloque Browser (webview)
│   ├── Bloque Pomodoro (timer circular)
│   └── Bloque TaskList (checklist anidada)
├── VireToolbar + VireContextMenu
└── VireTopbar (pestañas de proyecto)
```

## Comunicación Frontend ↔ Rust (IPC)

| Mecanismo | Uso |
|-----------|-----|
| **Tauri Channels** (`tauri::ipc::Channel`) | Streaming de output de terminal (alto throughput, ordenado) |
| **Tauri Commands** (`#[tauri::command]` + `invoke()`) | Operaciones puntuales: terminal_input, resize, close, CRUD proyectos/boards/config, file I/O, run_agent |
| **Tauri Events** | (No usado actualmente — reservado para broadcasts) |

17 commands registrados: open_terminal, terminal_input, resize_terminal, close_terminal, list_projects, upsert_project, delete_project, save_board, load_board, get_config, set_config, read_text_file, write_text_file, run_agent.

Flujo terminal: Frontend → `invoke('open_terminal', {surface_id, project_id, cols, rows, on_frame: Channel})` → Rust busca session existente (reattach) o spawna nuevo PTY + vt100 thread → Channel streaming TermFrames → Frontend renderiza en canvas 2D. Input: captura teclas → keyToBytes() → `invoke('terminal_input', {surface_id, data})` → PTY write.

## Brand — "Precision Tool"

Leica, no galería. Tactile, quiet, confident. **"The canvas comes first"**.

### Midnight Canvas Design Tokens

```css
--color-canvas: #101010;        --color-surface: #1a1a1a;
--color-surface-elevated: #242424;  --color-border: #2a2a2a;
--color-divider: #1f1f1f;
--color-text-primary: #f3f3f3;  --color-text-secondary: #949494;
--color-text-muted: #6b6b6b;    --color-accent: #e7c59a;
/* Syntax (solo terminal output, nunca UI chrome) */
--color-err: #fc618d;  --color-ok: #7bd88f;
--color-warn: #f8e67a; --color-path: #948ae3;
--font-ui: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--radius-sm: 4px;  --radius-control: 8px;  --radius-block: 12px;  --radius-pill: 99px;
/* Glass */
--glass-block-bg: rgba(30,30,30,0.78);  --glass-blur: blur(20px) saturate(180%);
--shadow-block: 0 1px 2px rgba(0,0,0,0.35), 0 8px 40px rgba(0,0,0,0.45);
```

### Reglas de diseño vigentes

1. Canvas es espacio negativo. Bloques flotan con glass effect (blur + bordes translúcidos).
2. Un acento cromático por viewport (ámbar #e7c59a).
3. Tipografía hace el 90% del trabajo visual.
4. Colores de sintaxis reservados para output de terminal. Nunca UI chrome.
5. Bordes: activo = ámbar, inactivo = #1f1f1f hairline.
6. Bloques oscuros (rgba(30,30,30,0.78)), no blancos.
7. Radius 12px en bloques (signature radius).
8. Grid 40px de dots al ~3.5% en canvas.
9. Container queries para escalado responsive de todos los bloques.

## Terminal Engine (vt100 + portable-pty)

- **vt100** (`0.15`): parser VT puro en Rust (sin C, sin zig). Maneja secuencias ANSI, grid de caracteres, cursor, colores 256+truecolor.
- **portable-pty** (`0.8`): crate de wezterm para spawn PTY + reader/writer. Multiplataforma.
- **TermFrame**: snapshot del grid (cols, rows, cursor, grid de TermCell con ch/foreground/background/bold/italic/inverse).
- **ProcessManager**: spawn PTY, attach (sink swappable + Snapshot), resize, input, close, kill_all.
- **Terminal session persistence**: cerrar ventana la oculta (no mata procesos). Tray icon con "Mostrar Vire"/"Salir" (kill_all + exit). Reattach via `ProcessManager::attach()`.
- Decisión (2026-07-05): libghostty-vt descartado por incompatibilidad macOS 26. vt100+portable-pty elegido. Ver `06-Decision-VT-Engine.md` en vault.

## Persistencia (SQLite via rusqlite)

| Dato | Cómo |
|------|------|
| Proyectos | Tabla `projects` (id, name, timestamps) |
| Layout bloques + camera | Tabla `boards` (project_id, blocks_json, camera_json) via Zustand persist middleware |
| Config AI CLIs | Tabla `configs` (key, value_json) |
| Terminales activas | Tabla `terminals` (id, project_id, block_id, cwd, shell) |

## Fases

- **Fase 0** ✅ — Scaffold Tauri + Vite + módulos Rust
- **Fase 1** ✅ — Canvas custom (pan/zoom, bring-to-front), toolbar, topbar, grid, Pomodoro, TaskList
- **Fase 2** ✅ — Terminal engine (vt100 + portable-pty, streaming via Channels)
- **Fase 3** ✅ — Persistencia (SQLite, board snapshots, config CLIs)
- **Fase 4** ✅ — CI/CD + Browser/Note blocks + terminal session persistence (tray + reattach)
- **Fase 5** ✅ — Agent block, Monaco editor, pase visual glass + escalado responsive
