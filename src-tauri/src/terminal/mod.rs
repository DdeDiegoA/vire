// terminal module - Vire backend
use serde::Serialize;
use std::sync::mpsc::Receiver;
use vt100::{Color, Parser};

pub enum TermCmd {
    Write(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Kill,
}

#[derive(Serialize, Clone)]
pub struct TermCell {
    pub ch: String,
    pub fg: Option<[u8; 3]>,
    pub bg: Option<[u8; 3]>,
    pub bold: bool,
    pub italic: bool,
    pub inverse: bool,
}

#[derive(Serialize, Clone)]
pub struct TermCursor {
    pub x: u16,
    pub y: u16,
    pub visible: bool,
}

#[derive(Serialize, Clone)]
pub struct TermFrame {
    pub cols: u16,
    pub rows: u16,
    pub cursor: TermCursor,
    pub grid: Vec<Vec<TermCell>>,
}

// ponytail: standard xterm 256-color palette approximation, no crate for this
fn idx_to_rgb(idx: u8) -> [u8; 3] {
    const BASIC: [[u8; 3]; 16] = [
        [0, 0, 0], [205, 0, 0], [0, 205, 0], [205, 205, 0],
        [0, 0, 238], [205, 0, 205], [0, 205, 205], [229, 229, 229],
        [127, 127, 127], [255, 0, 0], [0, 255, 0], [255, 255, 0],
        [92, 92, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
    ];
    match idx {
        0..=15 => BASIC[idx as usize],
        16..=231 => {
            let i = idx - 16;
            let r = i / 36;
            let g = (i % 36) / 6;
            let b = i % 6;
            let scale = |v: u8| if v == 0 { 0 } else { 55 + v * 40 };
            [scale(r), scale(g), scale(b)]
        }
        232..=255 => {
            let v = 8 + (idx - 232) * 10;
            [v, v, v]
        }
    }
}

fn color_to_rgb(color: Color) -> Option<[u8; 3]> {
    match color {
        Color::Default => None,
        Color::Idx(i) => Some(idx_to_rgb(i)),
        Color::Rgb(r, g, b) => Some([r, g, b]),
    }
}

fn build_frame(parser: &Parser) -> TermFrame {
    let screen = parser.screen();
    let (rows, cols) = screen.size();
    let (cur_row, cur_col) = screen.cursor_position();

    let mut grid = Vec::with_capacity(rows as usize);
    for row in 0..rows {
        let mut line = Vec::with_capacity(cols as usize);
        for col in 0..cols {
            let cell = screen.cell(row, col);
            line.push(match cell {
                Some(c) => TermCell {
                    ch: c.contents(),
                    fg: color_to_rgb(c.fgcolor()),
                    bg: color_to_rgb(c.bgcolor()),
                    bold: c.bold(),
                    italic: c.italic(),
                    inverse: c.inverse(),
                },
                None => TermCell {
                    ch: String::new(),
                    fg: None,
                    bg: None,
                    bold: false,
                    italic: false,
                    inverse: false,
                },
            });
        }
        grid.push(line);
    }

    TermFrame {
        cols,
        rows,
        cursor: TermCursor {
            x: cur_col,
            y: cur_row,
            visible: !screen.hide_cursor(),
        },
        grid,
    }
}

/// Owns the vt100 parser on its own OS thread. Feeds bytes in via `cmd_rx`,
/// emits a full-grid `TermFrame` after every `Write`/`Resize` via `on_frame`.
pub fn spawn(
    cols: u16,
    rows: u16,
    cmd_rx: Receiver<TermCmd>,
    on_frame: impl Fn(TermFrame) + Send + 'static,
) {
    std::thread::spawn(move || {
        let mut parser = Parser::new(rows, cols, 0);
        while let Ok(cmd) = cmd_rx.recv() {
            match cmd {
                TermCmd::Write(bytes) => {
                    parser.process(&bytes);
                    on_frame(build_frame(&parser));
                }
                TermCmd::Resize { cols, rows } => {
                    parser.set_size(rows, cols);
                    on_frame(build_frame(&parser));
                }
                TermCmd::Kill => break,
            }
        }
    });
}
