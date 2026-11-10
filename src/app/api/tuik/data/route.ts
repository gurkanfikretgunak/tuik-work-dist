import { relay, sameOrigin, jsonError, validDatasetId, sanitizeCriteria } from "@/lib/tuikProxy";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "forbidden");
  const id = new URL(request.url).searchParams.get("id");
  if (!validDatasetId(id)) return jsonError(400, "bad_id");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "bad_json");
  }
  const criteria = sanitizeCriteria(body);
  if (!criteria) return jsonError(400, "bad_criteria");
  return relay(`/datasets/${encodeURIComponent(id)}/data`, { method: "POST", body: JSON.stringify(criteria) });
}
