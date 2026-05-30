"use client";

import { usePins, PIN_TYPE_LABELS } from "@/lib/pins";

export type CtxValue = { type: string; id: string; label: string; href: string } | null;

/** Sélection optionnelle d'un territoire / personne épinglé à associer. */
export function ContextSelect({
  value,
  onChange,
  className,
}: {
  value: CtxValue;
  onChange: (v: CtxValue) => void;
  className?: string;
}) {
  const pins = usePins();
  const selKey = value ? `${value.type}:${value.id}` : "";

  return (
    <select
      value={selKey}
      onChange={(e) => {
        const k = e.target.value;
        if (!k) return onChange(null);
        const p = pins.find((x) => `${x.type}:${x.id}` === k);
        onChange(p ? { type: p.type, id: p.id, label: p.label, href: p.href } : null);
      }}
      className={className}
      disabled={pins.length === 0}
    >
      <option value="">{pins.length === 0 ? "Aucune épingle à associer" : "Associer une épingle…"}</option>
      {pins.map((p) => (
        <option key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>
          {PIN_TYPE_LABELS[p.type]} · {p.label}
        </option>
      ))}
    </select>
  );
}
