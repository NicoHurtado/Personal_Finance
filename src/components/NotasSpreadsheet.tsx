"use client";

import "@fortune-sheet/react/dist/index.css";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useT } from "@/hooks/useT";
import type { Sheet } from "@fortune-sheet/core";

// Fortune Sheet imports heavy canvas — load only client-side
const Workbook = dynamic(() => import("@fortune-sheet/react").then((m) => m.Workbook), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      Cargando hoja de cálculo…
    </div>
  ),
});

const STORAGE_KEY = "notas-spreadsheet-data";

const defaultSheets: Sheet[] = [
  {
    name: "Notas",
    id: "sheet1",
    celldata: [],
    order: 0,
    status: 1,
    row: 60,
    column: 26,
  },
];

export default function NotasSpreadsheet() {
  const t = useT();
  const [sheets, setSheets] = useState<Sheet[]>(defaultSheets);
  const [loaded, setLoaded] = useState(false);

  // Load saved data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSheets(parsed);
        }
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const handleChange = (data: Sheet[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore quota errors
    }
  };

  if (!loaded) return null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t.nav.notes}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tu espacio personal de notas con hoja de cálculo</p>
        </div>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden border border-border shadow-sm">
        <Workbook
          data={sheets}
          onChange={handleChange}
          showFormulaBar
          allowEdit
          showToolbar
          showSheetTabs
        />
      </div>
    </div>
  );
}
