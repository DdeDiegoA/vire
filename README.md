# Vire

Infinite canvas workspace para desarrollo con IA. Terminales Ghostty + agentes IA + herramientas en bloques flotantes sobre un canvas infinito.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Rust (Tauri v2) |
| Frontend | React 19 + TypeScript + Vite |
| Canvas | tldraw SDK |
| Terminal | libghostty-rs (GHOSTTY_SOURCE_DIR + Zig 0.15.x) |
| Build | Vite + Tauri CLI |

## Requisitos

- Rust toolchain (rustc 1.77+)
- Node.js 24.18 (ver `.nvmrc`)
- macOS (Tauri targets `dmg`/`app`)
- Zig 0.15.x en PATH (solo para libghostty)

## Desarrollo

```bash
npm install            # frontend deps
npm run dev           # frontend dev server (Vite) — http://localhost:5173
npm run tauri dev     # app completa (frontend + Tauri backend, ventana nativa)
npm run build         # frontend build (tsc -b && vite build)
npm run lint          # oxlint
```

**Estado actual (Fase 5):** canvas funcional con 7 tipos de bloque — Terminal (libghostty
real, sesiones persistentes), Agent (chat con IA), Editor (Monaco), Pomodoro (timer circular
con precisión de milisegundos), TaskList, Browser y Nota. Persistencia en SQLite vía
`ProjectManager` (proyectos, bloques, layout de canvas). CI/release workflows en GitHub
Actions. Pase visual de estética "glass" (blur, sombras, focus rings) y escalado responsive
por container queries en todos los bloques.

## Estructura

```
vire/
├── src/                     # Frontend (React + tldraw)
│   ├── App.tsx              # Canvas principal (wiring topbar/toolbar/grid/shapes)
│   ├── design-tokens.css    # Design system
│   ├── main.tsx             # Entry point
│   ├── canvas/               # VireCanvas, VireWindow (chrome de bloque), VireContextMenu
│   ├── shapes/
│   │   ├── blockTypes.ts    # Registro de tipos de bloque + iconos
│   │   └── blocks/          # Terminal, Agent, Editor, Pomodoro, TaskList, Browser, Note
│   ├── ui/                  # VireTopbar, VireToolbar
│   ├── components/          # SettingsPanel
│   └── store/                # Zustand (useVireStore, boardTypes, tauriStorage)
├── src-tauri/                # Backend (Rust)
│   ├── src/
│   │   ├── lib.rs           # Entry Tauri
│   │   ├── terminal/        # Integración libghostty
│   │   ├── process/         # Gestión de procesos
│   │   ├── project/         # Persistencia SQLite (ProjectManager)
│   │   ├── agent/           # Backend del bloque Agent
│   │   └── ipc/             # Comandos Tauri
│   └── tauri.conf.json
├── .github/workflows/        # ci.yml, release.yml
├── .nvmrc
└── package.json
```

## Fases

- **Fase 0** ✅ — Scaffold Tauri + tldraw + módulos Rust
- **Fase 1** ✅ — Canvas y UI core (custom shapes, toolbar, topbar, grid, Pomodoro, TaskList)
- **Fase 2** ✅ — Terminal engine (libghostty, streaming)
- **Fase 3** ✅ — Persistencia (SQLite, layout)
- **Fase 4** ✅ — CI/CD + DX
- **Fase 5** ✅ — Bloques Agent/Editor, persistencia de sesión de terminal, pase visual glass + escalado responsive

## Licencia

MIT
