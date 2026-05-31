// Route handler : presse locale via Google Actualités (RSS), récupéré côté
// serveur pour contourner le CORS. Pas de clé requise.

export type NewsArticle = {
  title: string;
  url: string;
  source: string | null;
  date: string | null;
  snippet: string | null;
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .trim();
}

function pick(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  // Déballe le CDATA, décode les entités (qui révèlent du HTML encodé), puis
  // retire toutes les balises (réelles + révélées), puis re-décode.
  let s = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = decode(s).replace(/<[^>]+>/g, " ");
  return decode(s).replace(/\s+/g, " ").trim();
}

function parseRss(xml: string, limit: number): NewsArticle[] {
  const items = xml.split("<item>").slice(1);
  const out: NewsArticle[] = [];
  for (const raw of items.slice(0, limit)) {
    const block = raw.split("</item>")[0] ?? raw;
    let title = pick(block, "title") ?? "";
    const url = pick(block, "link") ?? "";
    const source = pick(block, "source");
    const date = pick(block, "pubDate");
    if (!title || !url) continue;
    // Google News : « Titre - Source » → on isole le titre si la source est connue.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    // La <description> de Google News est une liste de liens HTML (pas un vrai
    // résumé) → on ne l'expose pas.
    out.push({ title, url, source, date, snippet: null });
  }
  return out;
}

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) {
    return Response.json({ articles: [] as NewsArticle[] });
  }
  const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
  try {
    const res = await fetch(feed, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MouvanciaBot/1.0)" },
      // Cache court : la presse locale ne change pas chaque seconde.
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      return Response.json({ articles: [], error: "Source indisponible" }, { status: 502 });
    }
    const xml = await res.text();
    return Response.json({ articles: parseRss(xml, 20) });
  } catch {
    return Response.json({ articles: [], error: "Source indisponible" }, { status: 502 });
  }
}
