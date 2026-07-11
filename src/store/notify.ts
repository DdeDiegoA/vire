import { invoke } from '@tauri-apps/api/core'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { isWindowFocused } from './windowFocus'

export async function notifyAgentDone(title: string, body: string): Promise<void> {
  const raw = await invoke<string | null>('get_config', { key: 'notifications:onlyUnfocused' }).catch(() => null)
  const onlyUnfocused = raw === null ? true : raw === 'true'
  if (onlyUnfocused && isWindowFocused()) return

  let granted = await isPermissionGranted()
  if (!granted) {
    granted = (await requestPermission()) === 'granted'
  }
  if (granted) sendNotification({ title, body })
}
