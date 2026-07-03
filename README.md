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
npm run dev           # frontend dev server (Vite)
npm run tauri dev     # app completa (frontend + Tauri backend)
npm run build         # frontend build
npm run lint          # oxlint
```

## Estructura

```
vire/
├── src/                  # Frontend (React + tldraw)
│   ├── App.tsx           # Canvas principal
│   ├── design-tokens.css # Design system
│   └── main.tsx          # Entry point
├── src-tauri/            # Backend (Rust)
│   ├── src/
│   │   ├── lib.rs        # Entry Tauri
│   │   ├── terminal/     # Integración libghostty
│   │   ├── process/      # Gestión de procesos
│   │   ├── project/      # Persistencia workspace
│   │   └── ipc/          # Comandos Tauri
│   └── tauri.conf.json
├── .nvmrc
└── package.json
```

## Fases

- **Fase 0** ✅ — Scaffold Tauri + tldraw + módulos Rust
- **Fase 1** — Canvas y UI core (custom shapes, toolbar, bloques)
- **Fase 2** — Terminal engine (libghostty, streaming)
- **Fase 3** — Persistencia (SQLite, layout)
- **Fase 4** — CI/CD + DX

## Licencia

MIT
