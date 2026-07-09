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
            );",
        )
        .map_err(|e| e.to_string())?;
        // Migration guard for DBs created before repo_path existed — CREATE
        // TABLE IF NOT EXISTS above only shapes fresh databases. Ignore the
        // error when the column is already there (no schema-version table
        // to check against instead).
        let _ = conn.execute("ALTER TABLE projects ADD COLUMN repo_path TEXT", []);
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
        conn.execute("DELETE FROM boards WHERE project_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM terminals WHERE project_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
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

    pub fn insert_terminal(&self, id: &str, project_id: &str, block_id: &str, cwd: Option<&str>, shell: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO terminals (id, project_id, block_id, cwd, shell, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
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
}
