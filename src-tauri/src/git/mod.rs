// git module - Vire backend
//
// Shells out to the `git` CLI (std::process::Command) instead of pulling in
// git2 — status/diff/stage/commit are one-shot, fast operations, matching
// the rest of the backend's synchronous, no-new-dependency style (see
// agent/mod.rs's build_command).
use std::process::Command;

#[derive(serde::Serialize)]
pub struct GitFileEntry {
    pub path: String,
    pub status: String,
}

#[derive(serde::Serialize)]
pub struct GitStatusDto {
    pub staged: Vec<GitFileEntry>,
    pub unstaged: Vec<GitFileEntry>,
    pub untracked: Vec<GitFileEntry>,
    pub branch: Option<String>,
}

fn run(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn current_branch(repo_path: &str) -> Option<String> {
    run(repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .map(|s| s.trim().to_string())
}

pub fn status(repo_path: &str) -> Result<GitStatusDto, String> {
    let raw = run(repo_path, &["status", "--porcelain=v1", "-z"])?;
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    let mut parts = raw.split('\0').filter(|s| !s.is_empty());
    while let Some(entry) = parts.next() {
        if entry.len() < 3 {
            continue;
        }
        let (code, rest) = entry.split_at(2);
        let path = rest.trim_start().to_string();
        let x = code.as_bytes()[0] as char;
        let y = code.as_bytes()[1] as char;
        // ponytail: rename/copy old-path (extra -z field) is dropped, only
        // the new path is shown — add old-path display if a rename view is asked for.
        if x == 'R' || x == 'C' {
            parts.next();
        }
        if x == '?' && y == '?' {
            untracked.push(GitFileEntry { path, status: code.to_string() });
            continue;
        }
        if x != ' ' {
            staged.push(GitFileEntry { path: path.clone(), status: code.to_string() });
        }
        if y != ' ' {
            unstaged.push(GitFileEntry { path, status: code.to_string() });
        }
    }

    Ok(GitStatusDto { staged, unstaged, untracked, branch: current_branch(repo_path) })
}

pub fn diff(repo_path: &str, file: &str, staged: bool, untracked: bool) -> Result<String, String> {
    if untracked {
        let empty = if cfg!(windows) { "NUL" } else { "/dev/null" };
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["diff", "--no-index", "--", empty, file])
            .output()
            .map_err(|e| e.to_string())?;
        // --no-index exits 1 when it found differences (the expected case here);
        // only bubble up when git itself failed to run the comparison.
        return match output.status.code() {
            Some(0) | Some(1) => Ok(String::from_utf8_lossy(&output.stdout).into_owned()),
            _ => Err(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        };
    }
    let mut args = vec!["diff"];
    if staged {
        args.push("--staged");
    }
    args.push("--");
    args.push(file);
    run(repo_path, &args)
}

pub fn stage(repo_path: &str, files: &[String]) -> Result<(), String> {
    let mut args = vec!["add", "--"];
    args.extend(files.iter().map(|s| s.as_str()));
    run(repo_path, &args)?;
    Ok(())
}

pub fn unstage(repo_path: &str, files: &[String]) -> Result<(), String> {
    let mut args = vec!["reset", "--"];
    args.extend(files.iter().map(|s| s.as_str()));
    run(repo_path, &args)?;
    Ok(())
}

pub fn commit(repo_path: &str, message: &str) -> Result<(), String> {
    run(repo_path, &["commit", "-m", message])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn init_repo(name: &str) -> String {
        let dir = std::env::temp_dir().join(format!("vire-git-test-{}-{}", std::process::id(), name));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.to_str().unwrap().to_string();
        run(&path, &["init", "-q"]).unwrap();
        run(&path, &["config", "user.email", "test@vire.local"]).unwrap();
        run(&path, &["config", "user.name", "Vire Test"]).unwrap();
        path
    }

    #[test]
    fn status_stage_commit_e2e() {
        let repo = init_repo("status-stage-commit");

        fs::write(format!("{repo}/tracked.txt"), "hello\n").unwrap();
        run(&repo, &["add", "tracked.txt"]).unwrap();
        run(&repo, &["commit", "-q", "-m", "initial"]).unwrap();

        fs::write(format!("{repo}/tracked.txt"), "hello world\n").unwrap();
        fs::write(format!("{repo}/untracked.txt"), "new\n").unwrap();

        let s = status(&repo).unwrap();
        assert_eq!(s.unstaged.len(), 1);
        assert_eq!(s.unstaged[0].path, "tracked.txt");
        assert_eq!(s.untracked.len(), 1);
        assert_eq!(s.untracked[0].path, "untracked.txt");
        assert!(s.staged.is_empty());
        assert!(s.branch.is_some());

        stage(&repo, &["tracked.txt".to_string(), "untracked.txt".to_string()]).unwrap();
        let s = status(&repo).unwrap();
        assert_eq!(s.staged.len(), 2);
        assert!(s.unstaged.is_empty());
        assert!(s.untracked.is_empty());

        unstage(&repo, &["untracked.txt".to_string()]).unwrap();
        let s = status(&repo).unwrap();
        assert_eq!(s.staged.len(), 1);
        assert_eq!(s.untracked.len(), 1);

        commit(&repo, "second commit").unwrap();
        let s = status(&repo).unwrap();
        assert_eq!(s.staged.len(), 0);
        assert_eq!(s.untracked.len(), 1);

        let d = diff(&repo, "untracked.txt", false, true).unwrap();
        assert!(d.contains("new"));

        let _ = fs::remove_dir_all(&repo);
    }
}
