// project module - Vire backend
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub repo_path: Option<String>,
}

pub struct WorktreeRow {
    pub id: String,
    pub project_id: String,
    pub path: String,
    pub branch: String,
}

pub struct BoardRow {
    pub blocks_json: String,
    pub camera_json: String,
}

fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64
}

pub struct ProjectManager {
    conn: Mutex<Connection>,
}

impl ProjectManager {
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                repo_path TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS boards (
                project_id TEXT PRIMARY KEY REFERENCES projects(id),
                blocks_json TEXT NOT NULL,
                camera_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS configs (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS terminals (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                block_id TEXT NOT NULL,
                cwd TEXT,
                shell TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS worktrees (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id),
                path TEXT NOT NULL,
                branch TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );",
        )
        .map_err(|e| e.to_string())?;
        // Migration guard for DBs created before repo_path existed — CREATE
        // TABLE IF NOT EXISTS above only shapes fresh databases. Ignore the
        // error when the column is already there (no schema-version table
        // to check against instead).
        let _ = conn.execute("ALTER TABLE projects ADD COLUMN repo_path TEXT", []);
        let _ = conn.execute("ALTER TABLE terminals ADD COLUMN scrollback BLOB", []);
        let _ = conn.execute("ALTER TABLE terminals ADD COLUMN agent_resume_cmd TEXT", []);
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn list_projects(&self) -> Result<Vec<ProjectRow>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, name, repo_path FROM projects ORDER BY created_at")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(ProjectRow { id: row.get(0)?, name: row.get(1)?, repo_path: row.get(2)? })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn get_repo_path(&self, id: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT repo_path FROM projects WHERE id = ?1", params![id], |row| row.get(0))
            .map_err(|e| e.to_string())
    }

    pub fn upsert_project(&self, id: &str, name: &str, repo_path: Option<&str>) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let ts = now();
        conn.execute(
            "INSERT INTO projects (id, name, repo_path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, repo_path = excluded.repo_path, updated_at = excluded.updated_at",
            params![id, name, repo_path, ts],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let worktree_ids: Vec<String> = conn
            .prepare("SELECT id FROM worktrees WHERE project_id = ?1")
            .map_err(|e| e.to_string())?
            .query_map(params![id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for wt_id in &worktree_ids {
            conn.execute("DELETE FROM boards WHERE project_id = ?1", params![wt_id])
                .map_err(|e| e.to_string())?;
            conn.execute("DELETE FROM terminals WHERE project_id = ?1", params![wt_id])
                .map_err(|e| e.to_string())?;
        }
        conn.execute("DELETE FROM worktrees WHERE project_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM boards WHERE project_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM terminals WHERE project_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_worktrees(&self, project_id: &str) -> Result<Vec<WorktreeRow>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, project_id, path, branch FROM worktrees WHERE project_id = ?1 ORDER BY created_at")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![project_id], |row| {
                Ok(WorktreeRow { id: row.get(0)?, project_id: row.get(1)?, path: row.get(2)?, branch: row.get(3)? })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn insert_worktree(&self, id: &str, project_id: &str, path: &str, branch: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO worktrees (id, project_id, path, branch, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, project_id, path, branch, now()],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_worktree(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM boards WHERE project_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM terminals WHERE project_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM worktrees WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_board(&self, project_id: &str, blocks_json: &str, camera_json: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO boards (project_id, blocks_json, camera_json, updated_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(project_id) DO UPDATE SET blocks_json = excluded.blocks_json,
                camera_json = excluded.camera_json, updated_at = excluded.updated_at",
            params![project_id, blocks_json, camera_json, now()],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_board(&self, project_id: &str) -> Result<Option<BoardRow>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT blocks_json, camera_json FROM boards WHERE project_id = ?1",
            params![project_id],
            |row| Ok(BoardRow { blocks_json: row.get(0)?, camera_json: row.get(1)? }),
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn get_config(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT value_json FROM configs WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn set_config(&self, key: &str, value_json: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO configs (key, value_json) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
            params![key, value_json],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    // Upsert, not insert: a terminal row can already exist for this id from a
    // prior run whose ProcessManager (in-memory) was wiped by an app restart
    // but whose DB row was never cleaned up (sessions only delete on explicit
    // close, not on hide/quit-without-kill). A plain INSERT would then fail
    // with a UNIQUE constraint error and block reopening the terminal.
    pub fn insert_terminal(&self, id: &str, project_id: &str, block_id: &str, cwd: Option<&str>, shell: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO terminals (id, project_id, block_id, cwd, shell, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, block_id = excluded.block_id,
                 cwd = excluded.cwd, shell = excluded.shell",
            params![id, project_id, block_id, cwd, shell, now()],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_terminal(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM terminals WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // Only ever called against rows that already exist (a terminal's scrollback
    // is saved right before quit, for sessions the user has actually opened) —
    // no upsert needed, unlike insert_terminal.
    pub fn save_scrollback(&self, id: &str, bytes: &[u8]) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE terminals SET scrollback = ?2 WHERE id = ?1", params![id, bytes])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_scrollback(&self, id: &str) -> Result<Option<Vec<u8>>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT scrollback FROM terminals WHERE id = ?1", params![id], |row| {
            row.get::<_, Option<Vec<u8>>>(0)
        })
        .optional()
        .map_err(|e| e.to_string())
        .map(|opt| opt.flatten())
    }

    pub fn get_terminal_cwd(&self, id: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT cwd FROM terminals WHERE id = ?1", params![id], |row| row.get::<_, Option<String>>(0))
            .optional()
            .map_err(|e| e.to_string())
            .map(|opt| opt.flatten())
    }

    // Captured right before a real quit (tray "Salir") when the PTY's
    // foreground job is a known agent CLI — see agent_resume::detect. Read
    // back once, on the next open_terminal for this id, to retype the exact
    // --resume command into the fresh shell.
    pub fn save_agent_resume(&self, id: &str, cmd: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE terminals SET agent_resume_cmd = ?2 WHERE id = ?1", params![id, cmd])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn clear_agent_resume(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE terminals SET agent_resume_cmd = NULL WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_agent_resume(&self, id: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT agent_resume_cmd FROM terminals WHERE id = ?1", params![id], |row| {
            row.get::<_, Option<String>>(0)
        })
        .optional()
        .map_err(|e| e.to_string())
        .map(|opt| opt.flatten())
    }
}
