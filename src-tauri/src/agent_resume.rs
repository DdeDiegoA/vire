// agent_resume module - Vire backend
//
// Detects an interactive agent CLI (claude, codex, gemini) running as the
// foreground job of a Terminal PTY, and builds the exact command line that
// resumes it — used only when the PTY itself doesn't survive (a real app
// quit, see ProcessManager::kill_all; a hide/reattach never needs this,
// the PTY just keeps running).
//
// ponytail: only claude's session-file layout is verified against a real
// install. codex/gemini paths below are best-effort guesses at their
// on-disk layout; if wrong, detect() just finds no session file and no-ops
// (no crash, no false resume). Fix the specific fn once someone hits a
// mismatch with a real install.
use std::path::PathBuf;
use std::time::SystemTime;

struct AgentCliSpec {
    binaries: &'static [&'static str],
    session_dir: fn(&str) -> Option<PathBuf>,
    resume_cmd: fn(&str, &str) -> String,
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn claude_session_dir(cwd: &str) -> Option<PathBuf> {
    let encoded = cwd.replace('/', "-");
    Some(home_dir()?.join(".claude").join("projects").join(encoded))
}

fn codex_session_dir(cwd: &str) -> Option<PathBuf> {
    let _ = cwd;
    Some(home_dir()?.join(".codex").join("sessions"))
}

fn gemini_session_dir(cwd: &str) -> Option<PathBuf> {
    let _ = cwd;
    Some(home_dir()?.join(".gemini").join("sessions"))
}

const BUILTIN: &[AgentCliSpec] = &[
    AgentCliSpec {
        binaries: &["claude"],
        session_dir: claude_session_dir,
        resume_cmd: |bin, id| format!("{bin} --resume {id}"),
    },
    AgentCliSpec {
        binaries: &["codex"],
        session_dir: codex_session_dir,
        resume_cmd: |bin, id| format!("{bin} --resume {id}"),
    },
    AgentCliSpec {
        binaries: &["gemini"],
        session_dir: gemini_session_dir,
        resume_cmd: |bin, id| format!("{bin} --resume {id}"),
    },
];

// Most recently modified file directly inside `dir`, treated as the session
// id source (file stem) — every CLI checked so far names session files by
// session-id.
fn latest_session_file(dir: &std::path::Path) -> Option<String> {
    let entries = std::fs::read_dir(dir).ok()?;
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .filter_map(|e| {
            let modified = e.metadata().ok()?.modified().ok()?;
            let stem = e.path().file_stem()?.to_str()?.to_string();
            Some((stem, modified))
        })
        .max_by_key(|(_, m): &(String, SystemTime)| *m)
        .map(|(stem, _)| stem)
}

/// If `comm` (the PTY's foreground process name) matches a known agent CLI,
/// look up its most recent session file for `cwd` and build the exact
/// command line that resumes it.
pub fn detect(comm: &str, cwd: &str) -> Option<String> {
    let spec = BUILTIN.iter().find(|s| s.binaries.contains(&comm))?;
    let dir = (spec.session_dir)(cwd)?;
    let session_id = latest_session_file(&dir)?;
    Some((spec.resume_cmd)(comm, &session_id))
}
