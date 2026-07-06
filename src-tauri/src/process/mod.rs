// process module - Vire backend
use crate::terminal::{self, TermCmd, TermFrame};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::mpsc;
use std::sync::Mutex;

struct TerminalHandle {
    cmd_tx: mpsc::Sender<TermCmd>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct ProcessManager {
    map: Mutex<HashMap<String, TerminalHandle>>,
}

impl ProcessManager {
    pub fn spawn(
        &self,
        surface_id: String,
        cols: u16,
        rows: u16,
        on_frame: impl Fn(TermFrame) + Send + 'static,
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

        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let child = pair
            .slave
            .spawn_command(CommandBuilder::new(shell))
            .map_err(|e| e.to_string())?;
        drop(pair.slave);

        let (cmd_tx, cmd_rx) = mpsc::channel::<TermCmd>();
        terminal::spawn(cols, rows, cmd_rx, on_frame);

        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let reader_tx = cmd_tx.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if reader_tx.send(TermCmd::Write(buf[..n].to_vec())).is_err() {
                            break;
                        }
                    }
                }
            }
        });

        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        self.map.lock().unwrap().insert(
            surface_id,
            TerminalHandle {
                cmd_tx,
                master: pair.master,
                writer,
                child,
            },
        );
        Ok(())
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
            .map_err(|e| e.to_string())?;
        handle
            .cmd_tx
            .send(TermCmd::Resize { cols, rows })
            .map_err(|e| e.to_string())
    }

    pub fn close(&self, surface_id: &str) -> Result<(), String> {
        let mut map = self.map.lock().unwrap();
        if let Some(mut handle) = map.remove(surface_id) {
            let _ = handle.cmd_tx.send(TermCmd::Kill);
            let _ = handle.child.kill();
        }
        Ok(())
    }
}
