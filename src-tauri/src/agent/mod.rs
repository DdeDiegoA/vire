// agent module - Vire backend
//
// Agent CLIs (claude, opencode, ...) are turn-based processes, not long-lived
// PTYs like terminal.rs/process.rs: one `spawn_run` per user message, the
// process exits when the turn is done. Multi-turn continuity comes from each
// CLI's own --resume/--session flag, not from keeping a process alive.
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

#[derive(Serialize, Clone)]
#[serde(tag = "kind")]
pub enum AgentEvent {
    // ponytail: claude (stream-json) and opencode (--format json) emit
    // different event shapes; normalizing both into one strict enum is real
    // work with only one CLI verified so far. Pass the raw JSON through and
    // let the frontend render generically until real usage across CLIs shows
    // what a shared schema needs to look like.
    Line { raw: serde_json::Value },
    Done { error: Option<String> },
}

fn build_command(cli: &str, prompt: &str, cwd: &str, session_id: Option<&str>) -> Result<Command, String> {
    let mut cmd = match cli {
        "claude" => {
            let mut c = Command::new("claude");
            c.arg("--print")
                .arg(prompt)
                .arg("--output-format")
                .arg("stream-json")
                .arg("--verbose");
            if let Some(id) = session_id {
                c.arg("--resume").arg(id);
            }
            c
        }
        "opencode" => {
            let mut c = Command::new("opencode");
            c.arg("run").arg(prompt).arg("--format").arg("json");
            if let Some(id) = session_id {
                c.arg("--session").arg(id);
            }
            c
        }
        other => return Err(format!("unsupported agent CLI: {other}")),
    };
    cmd.current_dir(cwd).stdout(Stdio::piped()).stderr(Stdio::null());
    Ok(cmd)
}

pub fn spawn_run(
    cli: String,
    prompt: String,
    cwd: String,
    session_id: Option<String>,
    on_event: impl Fn(AgentEvent) + Send + 'static,
) -> Result<(), String> {
    let mut cmd = build_command(&cli, &prompt, &cwd, session_id.as_deref())?;
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("no stdout")?;

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            let raw = serde_json::from_str::<serde_json::Value>(&line)
                .unwrap_or_else(|_| serde_json::json!({ "type": "text", "line": line }));
            on_event(AgentEvent::Line { raw });
        }
        let error = child.wait().err().map(|e| e.to_string());
        on_event(AgentEvent::Done { error });
    });
    Ok(())
}
