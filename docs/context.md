# Vire — Contexto de Proyecto

> Sync del vault de Obsidian (Proyectos/vire/01-Arquitectura, 02-Diseno, 04-Spike-Tecnico).
> Leer antes de cualquier cambio significativo.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Rust (Tauri v2) |
| Frontend | React 19 + TypeScript + Vite |
| Canvas | tldraw SDK |
| Terminal | libghostty-rs v0.2.0 (Ghostty GPU-accelerated) |
| Estado | Zustand (previsto) |
| Fonts | Inter (UI) + JetBrains Mono (terminal) |

## Arquitectura

```
Tauri Backend (Rust)
├── libghostty-rs
│   ├── PTY master (spawnea shell)
│   ├── VT Parser + State
│   └── Surface → grid de celdas
├── Project Manager (SQLite)
└── Process Manager
        │
        ▼ Tauri events/invoke
        │
Tauri Frontend (React + tldraw)
├── tldraw canvas (infinite)
│   ├── Custom shape "Terminal"
│   ├── Custom shape "Agent"
│   ├── Custom shape "Note"
│   └── Custom shape "Browser"
└── Toolbar + Topbar
```

## Comunicación Frontend ↔ Rust (IPC)

| Mecanismo | Uso |
|-----------|-----|
| **Tauri Channels** | Streaming de output de terminal (alto throughput, ordenado) |
| **Tauri Commands** | Operaciones puntuales: crear terminal, resize, input batch |
| **Tauri Events** | Broadcasts de estado global (cambios de proyecto, notificaciones) |

Flujo terminal: Frontend → `invoke('create_terminal')` → Rust spawn PTY + libghostty-vt → Channel streaming frames → Frontend renderiza en canvas. Input: captura teclas → `invoke('terminal_input')` → PTY write.

## Brand — "Precision Tool"

Leica, no galería. Tactile, quiet, confident. **"The canvas comes first"** — cada decisión se prueba con "¿esto compite con el contenido del usuario?".

### Midnight Canvas Design Tokens

```css
--color-canvas: #101010;        --color-surface: #1a1a1a;
--color-surface-elevated: #242424;  --color-divider: #1f1f1f;
--color-text-primary: #f3f3f3;  --color-text-secondary: #949494;
--color-text-muted: #6b6b6b;    --color-accent: #e7c59a;
/* Syntax (solo terminal output, nunca UI) */
--color-err: #fc618d;  --color-ok: #7bd88f;
--color-warn: #f8e67a; --color-path: #948ae3;
--font-ui: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--radius-sm: 4px;  --radius-md: 12px;  --radius-full: 99px;
```

### Reglas de diseño

1. Sin sombras. Profundidad = grises más claros + 1px borders.
2. Un acento cromático por viewport (ámbar #e7c59a).
3. Tipografía hace el 90% del trabajo visual.
4. Colores de sintaxis reservados para output de terminal. Nunca UI chrome.
5. Canvas es espacio negativo. Bloques flotan (sin glassmorphism, sin gradientes).
6. Bordes: activo = ámbar, inactivo = #1f1f1f hairline.
7. Bloques oscuros (#242424), no blancos (white on black = "holes in paper").
8. Radius 12px en bloques (signature radius).
9. Grid 40px al 3.5% en canvas.

## libghostty-rs v0.2.0

- **API principal:** `libghostty_vt::Terminal` (emulación VT completa), `RenderState::update(&terminal)`, `RowIterator`/`CellIterator`, `key::KeyEncoder`/`mouse::MouseEncoder`.
- **Thread safety:** `!Send` + `!Sync`. Offload a su propio hilo OS, comunicar con channels.
- **Build dep:** Zig 0.15.x en PATH. Opcional: `GHOSTTY_SOURCE_DIR` para checkout local.
- **Referencia:** `ghostling_rs` (~1000 líneas).
- **Diferencias con cmux:** cmux usa GhosttyKit.xcframework (Swift/Zig/AppKit); Vire usa libghostty-rs (Rust directo).

## tldraw Custom Shapes

Todos los bloques de Vire son shapes custom de tldraw que comparten un mecanismo base `VireBlock`. No necesitan herencia — una shape base que renderiza distinto según `type` (Terminal, Agent, Note, Browser, etc). Shapes planos, renderizan contenido vía `component`.

## Persistencia

| Dato | Cómo | Cuándo |
|------|------|--------|
| Layout bloques | JSON `.tldr` en SQLite | MVP |
| Config AI CLIs | SQLite | MVP |
| Scrollback | En memoria (10K líneas default) | MVP. V2: SQLite |
| Sesiones activas | Memoria, reconstruir al abrir | MVP |

## Fases

- **Fase 0 ✅** — Scaffold Tauri + tldraw + módulos Rust
- **Fase 1** — Canvas y UI core (custom shapes, toolbar, bloques)
- **Fase 2** — Terminal engine (libghostty, streaming)
- **Fase 3** — Persistencia (SQLite, layout)
- **Fase 4** — CI/CD + DX
