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

#[derive(serde::Serialize)]
pub struct WorktreeDto {
    pub path: String,
    pub branch: String,
    pub head: String,
}

fn slugify(branch: &str) -> String {
    branch
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>()
}

pub fn worktree_list(repo_path: &str) -> Result<Vec<WorktreeDto>, String> {
    let raw = run(repo_path, &["worktree", "list", "--porcelain"])?;
    let mut out = Vec::new();
    let (mut path, mut head, mut branch) = (None::<String>, None::<String>, None::<String>);
    let flush = |path: &mut Option<String>, head: &mut Option<String>, branch: &mut Option<String>, out: &mut Vec<WorktreeDto>| {
        if let Some(p) = path.take() {
            out.push(WorktreeDto {
                path: p,
                branch: branch.take().unwrap_or_default(),
                head: head.take().unwrap_or_default(),
            });
        }
    };
    for line in raw.lines() {
        if let Some(p) = line.strip_prefix("worktree ") {
            flush(&mut path, &mut head, &mut branch, &mut out);
            path = Some(p.to_string());
        } else if let Some(h) = line.strip_prefix("HEAD ") {
            head = Some(h.to_string());
        } else if let Some(b) = line.strip_prefix("branch refs/heads/") {
            branch = Some(b.to_string());
        } else if line.is_empty() {
            flush(&mut path, &mut head, &mut branch, &mut out);
        }
    }
    flush(&mut path, &mut head, &mut branch, &mut out);
    Ok(out)
}

pub fn worktree_add(repo_path: &str, branch: &str, base: Option<&str>) -> Result<String, String> {
    let repo_name = std::path::Path::new(repo_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("repo");
    let parent = std::path::Path::new(repo_path)
        .parent()
        .ok_or("repo_path has no parent directory")?;
    let target = parent
        .join(format!("{repo_name}-worktrees"))
        .join(slugify(branch));
    let target_str = target.to_str().ok_or("worktree path is not valid UTF-8")?.to_string();

    // branch doesn't exist yet -> create it (-b); base defaults to HEAD when absent.
    // branch already exists -> attach the worktree to it directly.
    let existing_branches = run(repo_path, &["branch", "--list", branch])?;
    if existing_branches.trim().is_empty() {
        let mut args = vec!["worktree", "add", "-b", branch, &target_str];
        if let Some(b) = base {
            args.push(b);
        }
        run(repo_path, &args)?;
    } else {
        run(repo_path, &["worktree", "add", &target_str, branch])?;
    }
    Ok(target_str)
}

pub fn worktree_remove(repo_path: &str, worktree_path: &str, force: bool) -> Result<(), String> {
    if !force {
        let dirty = run(worktree_path, &["status", "--porcelain"])?;
        if !dirty.trim().is_empty() {
            return Err("worktree has uncommitted changes".to_string());
        }
    }
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(worktree_path);
    run(repo_path, &args)?;
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

    #[test]
    fn worktree_add_list_remove_e2e() {
        let repo = init_repo("worktree");
        fs::write(format!("{repo}/tracked.txt"), "hello\n").unwrap();
        run(&repo, &["add", "tracked.txt"]).unwrap();
        run(&repo, &["commit", "-q", "-m", "initial"]).unwrap();

        let wt_path = worktree_add(&repo, "feature/foo", None).unwrap();
        assert!(wt_path.ends_with("worktree-worktrees/feature-foo"));
        assert!(std::path::Path::new(&wt_path).exists());

        let list = worktree_list(&repo).unwrap();
        assert_eq!(list.len(), 2); // main checkout + new worktree
        // Compare by suffix, not exact path: git canonicalizes symlinked temp
        // dirs (e.g. macOS /var -> /private/var) so the reported path may
        // differ textually from what worktree_add returned while pointing at
        // the same directory.
        assert!(list.iter().any(|w| w.path.ends_with("worktree-worktrees/feature-foo") && w.branch == "feature/foo"));

        // dirty worktree -> remove without force fails
        fs::write(format!("{wt_path}/tracked.txt"), "dirty\n").unwrap();
        assert!(worktree_remove(&repo, &wt_path, false).is_err());

        // clean it up, then remove without force succeeds
        run(&wt_path, &["checkout", "--", "tracked.txt"]).unwrap();
        worktree_remove(&repo, &wt_path, false).unwrap();
        assert!(!std::path::Path::new(&wt_path).exists());

        let list = worktree_list(&repo).unwrap();
        assert_eq!(list.len(), 1);

        let _ = fs::remove_dir_all(&repo);
        let _ = fs::remove_dir_all(std::path::Path::new(&repo).parent().unwrap().join("worktree-worktrees"));
    }
}
