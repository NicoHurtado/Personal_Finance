"use client";

/**
 * Dynamic card visual that renders any account's gradient from DB colors.
 * Also exports legacy named exports for backward compat.
 */

function CardFace({
  gradient,
  name,
  className = "",
}: {
  gradient: string;
  name?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-[0_8px_20px_rgba(10,21,25,0.12)] ${className}`}
      style={{ background: gradient }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.12) 100%)",
        }}
      />
      {name && (
        <span className="absolute bottom-3 left-4 text-white/90 text-[12px] font-semibold tracking-wide drop-shadow-sm select-none">
          {name}
        </span>
      )}
    </div>
  );
}

/**
 * Universal card — pass `color`, `colorGradientEnd`, and optionally `name` from the account document.
 */
export function AccountCard({
  color,
  colorGradientEnd,
  name,
  className = "",
}: {
  color: string;
  colorGradientEnd?: string;
  name?: string;
  className?: string;
}) {
  const end = colorGradientEnd || color;
  return <CardFace className={className} name={name} gradient={`linear-gradient(135deg, ${color} 0%, ${end} 100%)`} />;
}

/* Legacy named exports — kept so existing imports don't break */

export function NuCreditCard({ className = "" }: { className?: string }) {
  return <AccountCard color="#820AD1" colorGradientEnd="#5B0694" className={className} />;
}

export function BancolombiaDebitCard({ className = "" }: { className?: string }) {
  return <AccountCard color="#FCDA3F" colorGradientEnd="#E6B800" className={className} />;
}

export function ArqUsdDebitCard({ className = "" }: { className?: string }) {
  return <AccountCard color="#0F3B2E" colorGradientEnd="#062016" className={className} />;
}

export function VisaPlatinumCard({ className = "" }: { className?: string }) {
  return <AccountCard color="#D9DCE0" colorGradientEnd="#9EA5AC" className={className} />;
}
