// Sunucu tarafı yardımcılar: TÜİK Veri Portalı'na (databrowser2.tuik.gov.tr) kısıtlı, allowlist'li geçit.
// Yalnızca kamuya açık istatistik verisi çekilir; kullanıcının hiçbir verisi yukarı akışa gönderilmez.
export const UPSTREAM = "https://databrowser2.tuik.gov.tr/api/core/nodes/1";
export const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 45_000;
const ID_RE = /^[A-Za-z0-9_.+,-]{1,120}$/;
const DIM_RE = /^[A-Za-z0-9_]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9_.+\-: ]{1,60}$/;

export type Criteria = { id: string; filterValues: string[]; type: "CodeValues" };

/** API yalnızca Türkçe ve İngilizce etiket verir; diğer arayüz dilleri İngilizce kullanır. */
export type ApiLang = "tr" | "en";
export const toApiLang = (l: unknown): ApiLang => (l === "tr" ? "tr" : "en");

export function validDatasetId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/** İstemciden gelen filtreleri doğrular; geçersizse null. */
export function sanitizeCriteria(body: unknown): Criteria[] | null {
  if (!Array.isArray(body) || body.length > 60) return null;
  const out: Criteria[] = [];
  for (const c of body) {
    if (!c || typeof c !== "object") return null;
    const { id, filterValues } = c as { id?: unknown; filterValues?: unknown };
    if (typeof id !== "string" || !DIM_RE.test(id)) return null;
    if (!Array.isArray(filterValues) || filterValues.length === 0 || filterValues.length > 5000) return null;
    if (!filterValues.every((v) => typeof v === "string" && CODE_RE.test(v))) return null;
    out.push({ id, filterValues: filterValues as string[], type: "CodeValues" });
  }
  return out;
}

/** Aynı kaynaktan (same-origin) olmayan tarayıcı çağrılarını reddeder (açık proxy olmasın). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // sunucudan sunucuya / aynı sayfa GET'leri
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export function jsonError(status: number, code: string) {
  return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function relay(path: string, init?: { method?: "GET" | "POST"; body?: string; lang?: ApiLang }): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${UPSTREAM}${path}`, {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json", Accept: "application/json", UserLang: init?.lang ?? "en", "User-Agent": "tuik-work-dist/educational" },
      body: init?.body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return jsonError(502, "upstream_unreachable");
  }
  if (!res.ok) return jsonError(res.status === 404 ? 404 : 502, `upstream_${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return jsonError(413, "too_large");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return jsonError(413, "too_large");
  return new Response(buf, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
