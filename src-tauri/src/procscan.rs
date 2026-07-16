// procscan module - Vire backend
//
// Unix-only process-tree and open-port introspection, shelled out to
// `ps`/`lsof` rather than raw syscalls — a couple of subprocess spawns per
// lazy request (block focus poll / app quit) is cheap and avoids extra
// low-level deps. No-ops on Windows (no ConPTY-friendly equivalent wired
// up yet).

#[cfg(unix)]
use std::process::Command;

#[cfg(unix)]
pub fn process_name(pid: i32) -> Option<String> {
    let out = Command::new("ps").args(["-o", "comm=", "-p", &pid.to_string()]).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if name.is_empty() {
        return None;
    }
    Some(name.rsplit('/').next().unwrap_or(&name).to_string())
}

#[cfg(unix)]
fn descendants(root: u32) -> Vec<u32> {
    let out = match Command::new("ps").args(["-eo", "pid=,ppid="]).output() {
        Ok(o) if o.status.success() => o,
        _ => return vec![root],
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let pairs: Vec<(u32, u32)> = text
        .lines()
        .filter_map(|line| {
            let mut it = line.split_whitespace();
            let pid: u32 = it.next()?.parse().ok()?;
            let ppid: u32 = it.next()?.parse().ok()?;
            Some((pid, ppid))
        })
        .collect();

    let mut result = vec![root];
    let mut frontier = vec![root];
    while !frontier.is_empty() {
        let mut next = vec![];
        for &parent in &frontier {
            for &(pid, ppid) in &pairs {
                if ppid == parent && !result.contains(&pid) {
                    result.push(pid);
                    next.push(pid);
                }
            }
        }
        frontier = next;
    }
    result
}

#[cfg(unix)]
pub fn listening_ports(root_pid: u32) -> Vec<u16> {
    let pids = descendants(root_pid);
    let pid_list = pids.iter().map(u32::to_string).collect::<Vec<_>>().join(",");
    let out = match Command::new("lsof").args(["-a", "-p", &pid_list, "-iTCP", "-sTCP:LISTEN", "-Fn"]).output() {
        Ok(o) => o,
        Err(_) => return vec![],
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut ports: Vec<u16> = text
        .lines()
        .filter(|l| l.starts_with('n'))
        .filter_map(|l| l.rsplit(':').next())
        .filter_map(|p| p.parse().ok())
        .collect();
    ports.sort_unstable();
    ports.dedup();
    ports
}

#[cfg(not(unix))]
pub fn process_name(_pid: i32) -> Option<String> {
    None
}

#[cfg(not(unix))]
pub fn listening_ports(_root_pid: u32) -> Vec<u16> {
    vec![]
}
