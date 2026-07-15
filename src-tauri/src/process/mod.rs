// process module - Vire backend
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

// Swappable subscriber: on reattach (project switch back to an already-running
// terminal), we replace the closure in place instead of respawning the PTY —
// the session (shell, scrollback) never dies.
type Sink = Arc<Mutex<Box<dyn Fn(&[u8]) + Send>>>;

// Bytes kept per session so a reattaching frontend can replay them into a
// fresh xterm.js instance and reconstruct scrollback/cursor state.
const REPLAY_BUFFER_CAP: usize = 256 * 1024;

struct TerminalHandle {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    sink: Sink,
    replay_buffer: Arc<Mutex<Vec<u8>>>,
}

#[derive(Default)]
pub struct ProcessManager {
    map: Mutex<HashMap<String, TerminalHandle>>,
}

/// Cross-platform default shell: COMSPEC on Windows, SHELL on Unix, with
/// hardcoded fallbacks for when neither env var exists.
pub(crate) fn default_shell() -> String {
    if cfg!(windows) {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

/// Shells listed in /etc/shells that actually exist on disk — used to
/// populate the shell picker in Settings. Empty on Windows (no equivalent).
pub fn list_shells() -> Vec<String> {
    if cfg!(windows) {
        return vec![];
    }
    std::fs::read_to_string("/etc/shells")
        .map(|contents| {
            contents
                .lines()
                .map(str::trim)
                .filter(|l| !l.is_empty() && !l.starts_with('#'))
                .filter(|l| std::path::Path::new(l).exists())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

impl ProcessManager {
    pub fn spawn(
        &self,
        surface_id: String,
        cols: u16,
        rows: u16,
        term: String,
        shell: String,
        cwd: Option<String>,
        on_data: impl Fn(&[u8]) + Send + 'static,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        // new_default_prog() makes portable_pty run the shell as a login
        // shell itself (argv0 = "-<basename>"), so .zprofile/.bash_profile
        // load — matching Terminal.app. Without this, a build launched from
        // Finder (not a login shell) misses PATH/prompt setup done there.
        let mut cmd = CommandBuilder::new_default_prog();
        if !cfg!(windows) {
            cmd.env("SHELL", &shell);
        }
        cmd.env("TERM", &term);
        cmd.env("COLORTERM", "truecolor");
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave);

        let sink: Sink = Arc::new(Mutex::new(Box::new(on_data)));
        let replay_buffer: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));

        let sink_for_thread = sink.clone();
        let buffer_for_thread = replay_buffer.clone();
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let chunk = &buf[..n];
                        {
                            // ponytail: byte-boundary trim, not line/escape-aware —
                            // a reattach mid-truncation can replay a torn ANSI
                            // sequence. Self-heals on the next redraw; revisit if
                            // that flicker turns out to bother anyone.
                            let mut b = buffer_for_thread.lock().unwrap();
                            b.extend_from_slice(chunk);
                            let overflow = b.len().saturating_sub(REPLAY_BUFFER_CAP);
                            if overflow > 0 {
                                b.drain(0..overflow);
                            }
                        }
                        (sink_for_thread.lock().unwrap())(chunk);
                    }
                }
            }
        });

        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        self.map.lock().unwrap().insert(
            surface_id,
            TerminalHandle {
                master: pair.master,
                writer,
                child,
                sink,
                replay_buffer,
            },
        );
        Ok(())
    }

    pub fn exists(&self, surface_id: &str) -> bool {
        self.map.lock().unwrap().contains_key(surface_id)
    }

    /// Reattaches a frontend to an already-running session: swaps the data
    /// subscriber in place (no new PTY/shell spawned) and replays the
    /// buffered scrollback so a fresh xterm.js instance can reconstruct
    /// the screen exactly where it was left.
    pub fn attach(&self, surface_id: &str, on_data: impl Fn(&[u8]) + Send + 'static) -> Result<(), String> {
        let map = self.map.lock().unwrap();
        let handle = map.get(surface_id).ok_or("terminal not found")?;
        let snapshot = handle.replay_buffer.lock().unwrap().clone();
        *handle.sink.lock().unwrap() = Box::new(on_data);
        let sink = handle.sink.clone();
        drop(map);
        (sink.lock().unwrap())(&snapshot);
        Ok(())
    }

    /// Kills every live session — only called on an explicit app quit (tray
    /// "Salir"), never on a window hide/close, so sessions survive that.
    pub fn kill_all(&self) {
        let mut map = self.map.lock().unwrap();
        for (_, mut handle) in map.drain() {
            let _ = handle.child.kill();
        }
    }

    pub fn input(&self, surface_id: &str, data: Vec<u8>) -> Result<(), String> {
        let mut map = self.map.lock().unwrap();
        let handle = map.get_mut(surface_id).ok_or("terminal not found")?;
        handle.writer.write_all(&data).map_err(|e| e.to_string())
    }

    pub fn resize(&self, surface_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let map = self.map.lock().unwrap();
        let handle = map.get(surface_id).ok_or("terminal not found")?;
        handle
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    /// Snapshot of every live session's replay buffer, for persisting
    /// scrollback to disk right before a real quit (tray "Salir") — the only
    /// path that actually kills every PTY, so it's the only point where an
    /// in-memory-only buffer would otherwise be lost for good.
    pub fn snapshot_all(&self) -> Vec<(String, Vec<u8>)> {
        self.map
            .lock()
            .unwrap()
            .iter()
            .map(|(id, handle)| (id.clone(), handle.replay_buffer.lock().unwrap().clone()))
            .collect()
    }

    pub fn close(&self, surface_id: &str) -> Result<(), String> {
        let mut map = self.map.lock().unwrap();
        if let Some(mut handle) = map.remove(surface_id) {
            let _ = handle.child.kill();
        }
        Ok(())
    }
}
