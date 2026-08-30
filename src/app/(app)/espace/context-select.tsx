"use client";

import { usePins, PIN_TYPE_LABELS } from "@/lib/pins";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@appica/ui-react/select";

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
  const placeholder = pins.length === 0 ? "Aucune épingle à associer" : "Associer une épingle…";

  return (
    <Select
      value={selKey}
      onValueChange={(next) => {
        const k = String(next ?? "");
        if (!k) return onChange(null);
        const p = pins.find((x) => `${x.type}:${x.id}` === k);
        onChange(p ? { type: p.type, id: p.id, label: p.label, href: p.href } : null);
      }}
      size="sm"
      disabled={pins.length === 0}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{placeholder}</SelectItem>
        {pins.map((p) => (
          <SelectItem key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>
            {PIN_TYPE_LABELS[p.type]} · {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
