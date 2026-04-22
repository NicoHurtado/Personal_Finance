"use client";

import { useEffect, useRef, useCallback, useReducer, useState } from "react";
import { useT } from "@/hooks/useT";
import { useLangStore } from "@/store/langStore";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_ROWS = 40;
const DEFAULT_COLS = 16;
const COL_WIDTH = 120;
const ROW_HEIGHT = 28;
const HEADER_WIDTH = 48;

// ─── Types ────────────────────────────────────────────────────────────────────
type CellId = string; // "A1", "B3", etc.

interface CellData {
  raw: string;       // what the user typed (could be "=A1+B1")
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  bg?: string;
  color?: string;
}

interface Selection {
  anchor: { r: number; c: number };
  focus: { r: number; c: number };
}

interface SheetState {
  cells: Record<CellId, CellData>;
  rows: number;
  cols: number;
}

type Action =
  | { type: "SET_CELL"; id: CellId; data: Partial<CellData> }
  | { type: "SET_FORMAT"; ids: CellId[]; format: Partial<CellData> }
  | { type: "ADD_ROW" }
  | { type: "ADD_COL" }
  | { type: "LOAD"; state: SheetState };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function colLetter(c: number): string {
  let s = "";
  let n = c + 1;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellId(r: number, c: number): CellId {
  return `${colLetter(c)}${r + 1}`;
}

function parseRef(id: CellId): { r: number; c: number } | null {
  const m = id.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: parseInt(m[2]) - 1, c: c - 1 };
}

function parseRange(range: string): CellId[] {
  const [start, end] = range.split(":");
  if (!end) return [start.toUpperCase()];
  const s = parseRef(start);
  const e = parseRef(end);
  if (!s || !e) return [];
  const ids: CellId[] = [];
  for (let r = Math.min(s.r, e.r); r <= Math.max(s.r, e.r); r++)
    for (let c = Math.min(s.c, e.c); c <= Math.max(s.c, e.c); c++)
      ids.push(cellId(r, c));
  return ids;
}

function evaluate(raw: string, cells: Record<CellId, CellData>, depth = 0): number | string {
  if (depth > 50) return "#CIRC!";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("=")) return trimmed;

  let expr = trimmed.slice(1).trim();

  // Replace function calls first
  expr = expr.replace(/([A-Z]+)\(([^)]+)\)/gi, (_match, fn, args) => {
    const fnName = fn.toUpperCase();
    const argList = args.split(",").map((a: string) => a.trim());

    const getVals = (arg: string): number[] => {
      if (arg.includes(":")) {
        return parseRange(arg)
          .map((id) => evaluate(cells[id]?.raw ?? "", cells, depth + 1))
          .filter((v) => typeof v === "number" && isFinite(v as number)) as number[];
      } else {
        const v = evaluate(cells[arg.toUpperCase()]?.raw ?? "", cells, depth + 1);
        return typeof v === "number" ? [v] : [];
      }
    };

    const allVals = argList.flatMap(getVals);

    switch (fnName) {
      case "SUM": return String(allVals.reduce((s: number, v: number) => s + v, 0));
      case "AVERAGE": return allVals.length ? String(allVals.reduce((s: number, v: number) => s + v, 0) / allVals.length) : "0";
      case "MIN": return allVals.length ? String(Math.min(...allVals)) : "0";
      case "MAX": return allVals.length ? String(Math.max(...allVals)) : "0";
      case "COUNT": return String(allVals.length);
      case "ABS": return String(Math.abs(allVals[0] ?? 0));
      case "ROUND": return allVals.length >= 2 ? String(parseFloat(allVals[0].toFixed(Math.round(allVals[1])))) : String(Math.round(allVals[0] ?? 0));
      default: return "#NAME?";
    }
  });

  // Replace cell references
  expr = expr.replace(/\b([A-Z]+\d+)\b/gi, (ref) => {
    const v = evaluate(cells[ref.toUpperCase()]?.raw ?? "", cells, depth + 1);
    return typeof v === "number" ? String(v) : isNaN(Number(v)) ? "0" : v;
  });

  try {
    // Safe eval using Function
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result === "number") return isFinite(result) ? result : "#DIV/0!";
    return String(result);
  } catch {
    return "#ERROR!";
  }
}

function displayValue(raw: string, cells: Record<CellId, CellData>): string {
  if (!raw) return "";
  if (!raw.startsWith("=")) return raw;
  const v = evaluate(raw, cells);
  if (typeof v === "number") {
    // Format numbers nicely
    return Number.isInteger(v) ? String(v) : parseFloat(v.toFixed(10)).toString();
  }
  return String(v);
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state: SheetState, action: Action): SheetState {
  switch (action.type) {
    case "SET_CELL":
      return { ...state, cells: { ...state.cells, [action.id]: { ...state.cells[action.id], ...action.data } } };
    case "SET_FORMAT": {
      const next = { ...state.cells };
      for (const id of action.ids) next[id] = { ...next[id], ...action.format };
      return { ...state, cells: next };
    }
    case "ADD_ROW": return { ...state, rows: state.rows + 10 };
    case "ADD_COL": return { ...state, cols: state.cols + 4 };
    case "LOAD": return action.state;
    default: return state;
  }
}

const INIT: SheetState = { cells: {}, rows: DEFAULT_ROWS, cols: DEFAULT_COLS };
const STORAGE_KEY = "finance-spreadsheet";

// ─── Component ────────────────────────────────────────────────────────────────
export default function SpreadsheetPage() {
  const t = useT();
  const { lang } = useLangStore();
  const [state, dispatch] = useReducer(reducer, INIT);
  const [sel, setSel] = useState<Selection>({ anchor: { r: 0, c: 0 }, focus: { r: 0, c: 0 } });
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const [formulaBar, setFormulaBar] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [editingName, setEditingName] = useState(false);
  const [saved, setSaved] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formulaRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Load from localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.state) dispatch({ type: "LOAD", state: parsed.state });
        if (parsed.sheetName) setSheetName(parsed.sheetName);
      }
    } catch {}
  }, []);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, sheetName }));
    }, 500);
    return () => clearTimeout(timer);
  }, [state, sheetName]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeId = cellId(sel.anchor.r, sel.anchor.c);
  const activeCell = state.cells[activeId];

  const minR = Math.min(sel.anchor.r, sel.focus.r);
  const maxR = Math.max(sel.anchor.r, sel.focus.r);
  const minC = Math.min(sel.anchor.c, sel.focus.c);
  const maxC = Math.max(sel.anchor.c, sel.focus.c);
  const isSelected = (r: number, c: number) => r >= minR && r <= maxR && c >= minC && c <= maxC;
  const isActive = (r: number, c: number) => r === sel.anchor.r && c === sel.anchor.c;

  // ── Commit edit ────────────────────────────────────────────────────────────
  const commitEdit = useCallback((val?: string) => {
    const v = val ?? editVal;
    dispatch({ type: "SET_CELL", id: activeId, data: { raw: v } });
    setEditing(false);
    setFormulaBar(v);
  }, [editVal, activeId]);

  // ── Navigate ───────────────────────────────────────────────────────────────
  const navigate = useCallback((dr: number, dc: number, extend = false) => {
    setSel(prev => {
      const nr = Math.max(0, Math.min(state.rows - 1, prev.anchor.r + dr));
      const nc = Math.max(0, Math.min(state.cols - 1, prev.anchor.c + dc));
      if (extend) return { anchor: prev.anchor, focus: { r: nr, c: nc } };
      return { anchor: { r: nr, c: nc }, focus: { r: nr, c: nc } };
    });
    setEditing(false);
  }, [state.rows, state.cols]);

  // ── Key handler ────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Escape") { setEditing(false); setEditVal(activeCell?.raw ?? ""); return; }
      if (e.key === "Enter") { commitEdit(); navigate(1, 0); e.preventDefault(); return; }
      if (e.key === "Tab") { commitEdit(); navigate(0, e.shiftKey ? -1 : 1); e.preventDefault(); return; }
      return;
    }
    const shift = e.shiftKey;
    switch (e.key) {
      case "ArrowUp": navigate(-1, 0, shift); e.preventDefault(); break;
      case "ArrowDown": navigate(1, 0, shift); e.preventDefault(); break;
      case "ArrowLeft": navigate(0, -1, shift); e.preventDefault(); break;
      case "ArrowRight": navigate(0, 1, shift); e.preventDefault(); break;
      case "Tab": navigate(0, shift ? -1 : 1); e.preventDefault(); break;
      case "Enter": navigate(1, 0); e.preventDefault(); break;
      case "Delete":
      case "Backspace": {
        const ids = [];
        for (let r = minR; r <= maxR; r++)
          for (let c = minC; c <= maxC; c++)
            ids.push(cellId(r, c));
        dispatch({ type: "SET_FORMAT", ids, format: { raw: "" } });
        break;
      }
      case "F2": {
        const raw = activeCell?.raw ?? "";
        setEditVal(raw);
        setEditing(true);
        e.preventDefault();
        break;
      }
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          setEditVal(e.key === "=" ? "=" : e.key);
          setEditing(true);
        }
    }
  }, [editing, navigate, commitEdit, minR, maxR, minC, maxC, activeCell]);

  // ── Sync formula bar with active cell ─────────────────────────────────────
  useEffect(() => {
    if (!editing) setFormulaBar(state.cells[activeId]?.raw ?? "");
  }, [activeId, editing, state.cells]);

  // ── Focus input when editing ───────────────────────────────────────────────
  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setTimeout(() => gridRef.current?.focus(), 0);
    }
  }, [editing]);

  // ── Scroll active cell into view ───────────────────────────────────────────
  useEffect(() => {
    cellRefs.current[activeId]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  // ── Format helpers ─────────────────────────────────────────────────────────
  const getSelectedIds = () => {
    const ids: CellId[] = [];
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        ids.push(cellId(r, c));
    return ids;
  };

  const toggleFormat = (key: "bold" | "italic") => {
    const ids = getSelectedIds();
    const current = state.cells[activeId]?.[key];
    dispatch({ type: "SET_FORMAT", ids, format: { [key]: !current } });
    gridRef.current?.focus();
  };

  const setAlign = (align: "left" | "center" | "right") => {
    dispatch({ type: "SET_FORMAT", ids: getSelectedIds(), format: { align } });
    gridRef.current?.focus();
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, sheetName }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    if (confirm("¿Borrar toda la hoja?")) {
      dispatch({ type: "LOAD", state: INIT });
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const exportCSV = () => {
    const rows: string[] = [];
    for (let r = 0; r < state.rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < state.cols; c++) {
        const id = cellId(r, c);
        const raw = state.cells[id]?.raw ?? "";
        const val = displayValue(raw, state.cells);
        row.push(val.includes(",") ? `"${val}"` : val);
      }
      // Only include rows with content
      if (row.some(v => v)) rows.push(row.join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${sheetName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const selRange = minR === maxR && minC === maxC
    ? cellId(sel.anchor.r, sel.anchor.c)
    : `${cellId(minR, minC)}:${cellId(maxR, maxC)}`;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2.5rem)] -mx-4 md:-mx-8 -mt-6 md:-mt-10">
      {/* ── Toolbar ── */}
      <div className="flex flex-col border-b border-[var(--c-border)] bg-card shrink-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 gap-3 border-b border-[var(--c-border-2)]">
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                autoFocus
                className="text-[13px] font-semibold text-[var(--c-text)] border-b border-primary outline-none bg-transparent w-32"
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === "Enter" && setEditingName(false)}
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-[13px] font-semibold text-[var(--c-text)] hover:text-primary transition-colors"
              >
                {sheetName}
              </button>
            )}
            <span className="text-[11px] text-[var(--c-text-3)]">· {lang === "es" ? "guardado automáticamente" : "auto-saved"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="text-[12px] px-3 py-1 rounded-lg border border-[var(--c-border)] text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors">
              {saved ? "✓ Guardado" : (lang === "es" ? "Guardar" : "Save")}
            </button>
            <button onClick={exportCSV} className="text-[12px] px-3 py-1 rounded-lg border border-[var(--c-border)] text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors">
              CSV
            </button>
            <button onClick={handleClear} className="text-[12px] px-3 py-1 rounded-lg border border-[var(--c-expense-bg)] text-[var(--c-expense)] hover:bg-[var(--c-expense-bg)] transition-colors">
              {lang === "es" ? "Limpiar" : "Clear"}
            </button>
          </div>
        </div>

        {/* Format bar */}
        <div className="flex items-center gap-1 px-3 py-1.5 flex-wrap">
          {/* Cell ref */}
          <div className="flex items-center">
            <div className="w-[72px] text-[11px] font-mono font-medium text-[var(--c-text)] px-2 py-1 border border-[var(--c-border)] rounded-lg bg-[var(--c-surface-3)] text-center shrink-0">
              {selRange}
            </div>
          </div>

          <div className="w-px h-5 bg-[var(--c-border)] mx-1" />

          {/* Formula bar */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-[11px] text-[var(--c-text-3)] font-medium shrink-0">fx</span>
            <input
              ref={formulaRef}
              className="flex-1 text-[13px] text-[var(--c-text)] px-2 py-1 border border-[var(--c-border)] rounded-lg bg-card outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 min-w-0"
              value={formulaBar}
              onChange={e => {
                setFormulaBar(e.target.value);
                setEditVal(e.target.value);
                setEditing(true);
              }}
              onKeyDown={e => {
                if (e.key === "Enter") { commitEdit(formulaBar); navigate(1, 0); gridRef.current?.focus(); }
                if (e.key === "Escape") { setEditing(false); setFormulaBar(activeCell?.raw ?? ""); gridRef.current?.focus(); }
              }}
              onFocus={() => { setEditVal(activeCell?.raw ?? ""); setEditing(false); }}
            />
          </div>

          <div className="w-px h-5 bg-[var(--c-border)] mx-1" />

          {/* Format buttons */}
          <button
            onClick={() => toggleFormat("bold")}
            className={`w-7 h-7 rounded-md text-[13px] font-bold transition-colors ${activeCell?.bold ? "bg-primary text-white" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface)]"}`}
          >B</button>
          <button
            onClick={() => toggleFormat("italic")}
            className={`w-7 h-7 rounded-md text-[13px] italic transition-colors ${activeCell?.italic ? "bg-primary text-white" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface)]"}`}
          >I</button>

          <div className="w-px h-5 bg-[var(--c-border)] mx-1" />

          <button onClick={() => setAlign("left")} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${activeCell?.align === "left" ? "bg-primary text-white" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface)]"}`}>
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="2" y="3" width="12" height="1.5" rx="0.75"/><rect x="2" y="7" width="8" height="1.5" rx="0.75"/><rect x="2" y="11" width="10" height="1.5" rx="0.75"/></svg>
          </button>
          <button onClick={() => setAlign("center")} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${activeCell?.align === "center" ? "bg-primary text-white" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface)]"}`}>
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="2" y="3" width="12" height="1.5" rx="0.75"/><rect x="4" y="7" width="8" height="1.5" rx="0.75"/><rect x="3" y="11" width="10" height="1.5" rx="0.75"/></svg>
          </button>
          <button onClick={() => setAlign("right")} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${activeCell?.align === "right" ? "bg-primary text-white" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface)]"}`}>
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="2" y="3" width="12" height="1.5" rx="0.75"/><rect x="6" y="7" width="8" height="1.5" rx="0.75"/><rect x="4" y="11" width="10" height="1.5" rx="0.75"/></svg>
          </button>

          <div className="w-px h-5 bg-[var(--c-border)] mx-1" />

          <button onClick={() => { dispatch({ type: "ADD_ROW" }); }} className="text-[11px] px-2 py-1 rounded-md text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors whitespace-nowrap">
            + {lang === "es" ? "Filas" : "Rows"}
          </button>
          <button onClick={() => { dispatch({ type: "ADD_COL" }); }} className="text-[11px] px-2 py-1 rounded-md text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors whitespace-nowrap">
            + {lang === "es" ? "Columnas" : "Cols"}
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto bg-card">
        <div
          ref={gridRef}
          tabIndex={0}
          className="outline-none"
          onKeyDown={handleKeyDown}
          style={{ minWidth: HEADER_WIDTH + state.cols * COL_WIDTH }}
        >
          {/* Column headers */}
          <div className="flex sticky top-0 z-20 bg-[var(--c-surface-3)] border-b border-[var(--c-border)]" style={{ height: ROW_HEIGHT }}>
            {/* Corner */}
            <div className="shrink-0 border-r border-[var(--c-border)]" style={{ width: HEADER_WIDTH }} />
            {Array.from({ length: state.cols }, (_, c) => (
              <div
                key={c}
                className={`shrink-0 flex items-center justify-center text-[11px] font-semibold border-r border-[var(--c-border)] transition-colors ${
                  sel.anchor.c === c
                    ? "bg-primary text-white"
                    : c >= minC && c <= maxC
                    ? "bg-primary/15 text-primary"
                    : "text-[var(--c-text-3)]"
                }`}
                style={{ width: COL_WIDTH, height: ROW_HEIGHT }}
              >
                {colLetter(c)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: state.rows }, (_, r) => (
            <div key={r} className="flex border-b border-[var(--c-border-2)]" style={{ height: ROW_HEIGHT }}>
              {/* Row header */}
              <div
                className={`shrink-0 flex items-center justify-center text-[11px] font-semibold border-r border-[var(--c-border)] sticky left-0 z-10 transition-colors ${
                  sel.anchor.r === r
                    ? "bg-primary text-white"
                    : r >= minR && r <= maxR
                    ? "bg-primary/15 text-primary"
                    : "bg-[var(--c-surface-3)] text-[var(--c-text-3)]"
                }`}
                style={{ width: HEADER_WIDTH, height: ROW_HEIGHT }}
              >
                {r + 1}
              </div>

              {/* Cells */}
              {Array.from({ length: state.cols }, (_, c) => {
                const id = cellId(r, c);
                const cell = state.cells[id];
                const raw = cell?.raw ?? "";
                const display = displayValue(raw, state.cells);
                const active = isActive(r, c);
                const selected = isSelected(r, c);

                return (
                  <div
                    key={c}
                    ref={el => { cellRefs.current[id] = el; }}
                    className={`shrink-0 relative border-r select-none cursor-default overflow-hidden transition-colors ${
                      active
                        ? "z-20 border-[var(--c-border-2)]"
                        : selected && !(minR === maxR && minC === maxC)
                        ? "bg-primary/10 border-[var(--c-border-2)]"
                        : "border-[var(--c-border-2)] hover:bg-[var(--c-surface-3)]"
                    }`}
                    style={{
                      width: COL_WIDTH,
                      height: ROW_HEIGHT,
                      ...(active && {
                        outline: "2.5px solid oklch(0.527 0.154 150.069)",
                        outlineOffset: "-2px",
                      }),
                    }}
                    onMouseDown={(e) => {
                      if (e.shiftKey) {
                        setSel(prev => ({ ...prev, focus: { r, c } }));
                      } else {
                        setSel({ anchor: { r, c }, focus: { r, c } });
                        setEditing(false);
                        gridRef.current?.focus();
                      }
                    }}
                    onDoubleClick={() => {
                      setEditVal(raw);
                      setEditing(true);
                    }}
                  >
                    {/* Fill handle (Excel-style corner dot) */}
                    {active && !editing && (
                      <div className="absolute bottom-[-3px] right-[-3px] w-[6px] h-[6px] bg-primary border border-white z-30 cursor-crosshair" />
                    )}
                    {active && editing ? (
                      <input
                        ref={inputRef}
                        className="absolute inset-0 w-full h-full px-2 text-[12px] text-[var(--c-text)] outline-none border-0 bg-card"
                        value={editVal}
                        onChange={e => { setEditVal(e.target.value); setFormulaBar(e.target.value); }}
                        onKeyDown={e => {
                          if (e.key === "Enter") { commitEdit(); navigate(1, 0); e.preventDefault(); }
                          if (e.key === "Tab") { commitEdit(); navigate(0, e.shiftKey ? -1 : 1); e.preventDefault(); }
                          if (e.key === "Escape") { setEditing(false); e.preventDefault(); }
                        }}
                        onBlur={() => commitEdit()}
                      />
                    ) : (
                      <span
                        className="absolute inset-0 flex items-center px-2 text-[12px] overflow-hidden whitespace-nowrap"
                        style={{
                          fontWeight: cell?.bold ? 700 : 400,
                          fontStyle: cell?.italic ? "italic" : "normal",
                          justifyContent: cell?.align === "center" ? "center" : cell?.align === "right" ? "flex-end" : "flex-start",
                          color: display.startsWith("#") && display.length > 3 && isNaN(Number(display)) ? "var(--c-expense)" : "var(--c-text)",
                        }}
                      >
                        {display}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1 border-t border-[var(--c-border)] bg-[var(--c-surface-3)] text-[11px] text-[var(--c-text-3)]">
        <span>{selRange}</span>
        <span>
          {(() => {
            const ids = getSelectedIds();
            if (ids.length <= 1) return "";
            const vals = ids
              .map(id => state.cells[id]?.raw ?? "")
              .map(raw => displayValue(raw, state.cells))
              .filter(v => v && !isNaN(Number(v)))
              .map(Number);
            if (!vals.length) return "";
            const sum = vals.reduce((a, b) => a + b, 0);
            const avg = sum / vals.length;
            return `${lang === "es" ? "Suma" : "Sum"}: ${sum.toLocaleString()}  ·  ${lang === "es" ? "Promedio" : "Avg"}: ${avg.toFixed(2)}  ·  ${lang === "es" ? "Conteo" : "Count"}: ${vals.length}`;
          })()}
        </span>
        <span>
          {state.rows} × {state.cols}
        </span>
      </div>
    </div>
  );
}
