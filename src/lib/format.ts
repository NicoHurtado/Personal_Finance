export function formatCOP(value: number): string {
  const safe = isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const formatted = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  return safe < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatUSD(value: number): string {
  const safe = isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return safe < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function parseCOPAmount(monto: string): number {
  // Remove $ sign, dots (thousands separator), replace comma with decimal point
  let cleaned = monto.replace(/\$/g, "").trim();
  const isNegative = cleaned.startsWith("-");
  cleaned = cleaned.replace(/-/g, "");
  // Handle both "1.234.567,00" and "1.234.567" formats
  cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return isNegative ? -value : value;
}
