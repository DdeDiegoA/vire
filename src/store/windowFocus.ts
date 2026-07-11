import { getCurrentWindow } from '@tauri-apps/api/window'

// ponytail: plain module state, not a React store — only read at
// notification-fire time (a snapshot), never rendered, so no subscribers
// needed.
let focused = true

export function isWindowFocused(): boolean {
  return focused
}

export function initWindowFocusTracking(): void {
  getCurrentWindow()
    .onFocusChanged(({ payload }) => {
      focused = payload
    })
    .catch(() => {})
}
