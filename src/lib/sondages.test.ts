import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanLabel, formatDateFr, relativeFr, type Notice } from "@/lib/sondages";

/** Notice minimale : seuls `label` et `institut` comptent pour cleanLabel. */
function notice(partial: Partial<Notice>): Notice {
  return {
    numero: null,
    label: "",
    scrutin: "presidentielle",
    scrutin_label: "Présidentielle",
    institut: null,
    media: null,
    nature: "intentions",
    nature_label: "Intentions de vote",
    date: null,
    pdf: "",
    ...partial,
  };
}

describe("cleanLabel", () => {
  it("retire le préfixe de scrutin", () => {
    expect(cleanLabel(notice({ label: "Présidentielle 2027 intentions" }))).toBe("2027 intentions");
  });

  it("retire l'institut détecté", () => {
    expect(
      cleanLabel(notice({ label: "Légis. IFOP intentions de vote", institut: "IFOP" })),
    ).toBe("intentions de vote");
  });

  it("retire la date finale « JJ mois … »", () => {
    expect(cleanLabel(notice({ label: "Baromètre politique 12 mars 2026" }))).toBe("Baromètre politique");
  });

  it("retombe sur le label brut si le nettoyage vide tout", () => {
    const n = notice({ label: "Prés." });
    expect(cleanLabel(n)).toBe("Prés.");
  });
});

describe("formatDateFr", () => {
  it("formate une date ISO en français", () => {
    expect(formatDateFr("2022-04-10")).toBe("10 avril 2022");
  });

  it("renvoie « — » pour null et la chaîne brute si non parsable", () => {
    expect(formatDateFr(null)).toBe("—");
    expect(formatDateFr("pas-une-date")).toBe("pas-une-date");
  });
});

describe("relativeFr", () => {
  afterEach(() => vi.useRealTimers());

  function freeze(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  }

  it("renvoie « aujourd'hui » pour la date du jour", () => {
    freeze("2026-06-05T12:00:00Z");
    expect(relativeFr("2026-06-05T08:00:00Z")).toBe("aujourd'hui");
  });

  it("gère hier / il y a N jours dans le passé", () => {
    freeze("2026-06-05T12:00:00Z");
    expect(relativeFr("2026-06-04T12:00:00Z")).toBe("hier");
    expect(relativeFr("2026-06-01T12:00:00Z")).toBe("il y a 4 j");
  });

  it("gère demain / dans N jours dans le futur", () => {
    freeze("2026-06-05T12:00:00Z");
    expect(relativeFr("2026-06-06T12:00:00Z")).toBe("demain");
    expect(relativeFr("2026-06-10T12:00:00Z")).toBe("dans 5 j");
  });

  it("bascule en mois puis en années", () => {
    freeze("2026-06-05T12:00:00Z");
    expect(relativeFr("2026-04-05T12:00:00Z")).toBe("il y a 2 mois");
    expect(relativeFr("2024-06-05T12:00:00Z")).toBe("il y a 2 an(s)");
  });

  it("renvoie une chaîne vide pour null", () => {
    expect(relativeFr(null)).toBe("");
  });
});
