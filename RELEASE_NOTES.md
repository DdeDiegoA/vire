# Vire v0.1.0

Infinite canvas workspace para desarrollo con IA. Terminales, agentes, editor, notas, browser, pomodoro y tasklist en bloques flotantes sobre un canvas oscuro infinito.

## Features

- Canvas infinito con pan/zoom, minimap, grid overlay
- 7 tipos de bloque: Terminal, Agente, Editor (Monaco), Nota (markdown), Browser (webview), Pomodoro, TaskList
- Terminal real vía vt100 + portable-pty (zsh/cmd.exe según OS)
- Persistencia de sesión: cerrar ventana la oculta, las terminales siguen vivas. Tray icon.
- Persistencia de proyecto/layout vía SQLite
- Agentes IA: ejecutá claude u opencode desde el bloque Agent
- Auto-updater vía GitHub Releases
- CI/CD en macOS, Windows y Linux

## Descargas

| OS | Archivo |
|----|---------|
| macOS | `Vire_0.1.0_aarch64.dmg` (Apple Silicon) |
| Windows | `Vire_0.1.0_x64.msi` o `Vire_0.1.0_x64-setup.exe` |
| Linux | `Vire_0.1.0_amd64.AppImage` o `vire_0.1.0_amd64.deb` |
