# Vire

Infinite canvas workspace para desarrollo con IA. Terminales vt100 + agentes IA + herramientas en bloques flotantes sobre un canvas infinito oscuro.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Rust (Tauri v2) |
| Frontend | React 19 + TypeScript + Vite |
| Canvas | Custom (pan/zoom manual, sin tldraw) |
| Terminal | vt100 + portable-pty (wezterm crate) |
| Estado | Zustand |
| Fonts | Inter (UI) + JetBrains Mono (terminal) |

## Instalación (macOS)

La build actual **no está firmada con Apple Developer ID ni notarizada** (pendiente: certificado de pago + secrets en CI). Hasta que esté firmada, macOS Gatekeeper mostrará "Vire.app está dañado y no se puede abrir" al abrir la app descargada. Workaround para desbloquearla:

```bash
xattr -cr /Applications/Vire.app
```

O clic-derecho sobre `Vire.app` → Abrir → confirmar en el diálogo. Esto no reemplaza la firma real, solo permite instalar la build de prueba actual.

Setup de firma real (una vez se tenga cuenta Apple Developer Program): agregar los secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` en GitHub (Settings → Secrets → Actions) — `release.yml` ya está preparado para usarlos.

## Requisitos

- Rust toolchain (rustc 1.77+)
- Node.js 24.18 (ver `.nvmrc`)

## Desarrollo

```bash
npm install            # frontend deps
npm run dev           # frontend dev server (Vite) — http://localhost:5173
npm run tauri dev     # app completa (frontend + Tauri backend, ventana nativa)
npm run build         # frontend build (tsc -b && vite build)
npm run lint          # oxlint
```

**Estado actual (Fase 5):** canvas funcional con 7 tipos de bloque — Terminal (vt100+portable-pty, sesiones persistentes con tray icon), Agent (chat con IA vía claude/opencode), Editor (Monaco), Pomodoro (timer circular con precisión de milisegundos), TaskList (con subtareas anidadas), Browser (webview embebido), y Nota (markdown con preview). Persistencia en SQLite vía ProjectManager (proyectos, bloques, layout de canvas, terminales). CI/release workflows en GitHub Actions.

## Estructura

```
vire/
├── src/                     # Frontend (React)
│   ├── App.tsx              # Layout principal (topbar + canvas + toolbar)
│   ├── design-tokens.css    # Design system
│   ├── main.tsx             # Entry point
│   ├── canvas/              # VireCanvas (pan/zoom/minimap), VireWindow (chrome de bloque), VireContextMenu
│   ├── shapes/
│   │   ├── blockTypes.ts    # Tipos de bloque + datos por defecto
│   │   └── blocks/          # Terminal, Agent, Editor, Pomodoro, TaskList, Browser, Note
│   ├── ui/                  # VireTopbar, VireToolbar
│   ├── components/          # SettingsPanel
│   └── store/               # Zustand (useVireStore, boardTypes, tauriStorage)
├── src-tauri/               # Backend (Rust)
│   ├── src/
│   │   ├── lib.rs           # Entry Tauri + tray icon
│   │   ├── terminal/        # vt100 parser + TermFrame builder
│   │   ├── process/         # ProcessManager con sink swappable (reattach)
│   │   ├── project/         # Persistencia SQLite (ProjectManager)
│   │   ├── agent/           # Backend del bloque Agent (spawn CLI, stream JSON)
│   │   └── ipc/             # 17 comandos Tauri
│   └── tauri.conf.json
├── .github/workflows/        # ci.yml, release.yml
├── .nvmrc
└── package.json
```

## Fases

- **Fase 0** ✅ — Scaffold Tauri + Vite + módulos Rust
- **Fase 1** ✅ — Canvas custom (pan/zoom, bring-to-front), toolbar, topbar, grid, Pomodoro, TaskList
- **Fase 2** ✅ — Terminal engine (vt100 + portable-pty, streaming via Channels, input handling)
- **Fase 3** ✅ — Persistencia (SQLite, board snapshots, config CLIs)
- **Fase 4** ✅ — CI/CD + Browser/Note blocks + terminal session persistence (tray + reattach)
- **Fase 5** ✅ — Agent block, Monaco editor, pase visual glass + escalado responsive

## Licencia

MIT
