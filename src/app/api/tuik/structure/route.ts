import { toApiLang, relay, sameOrigin, jsonError, validDatasetId } from "@/lib/tuikProxy";

export async function GET(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "forbidden");
  const id = new URL(request.url).searchParams.get("id");
  if (!validDatasetId(id)) return jsonError(400, "bad_id");
  return relay(`/datasets/${encodeURIComponent(id)}/structure`, { lang: toApiLang(new URL(request.url).searchParams.get("lang")) });
}
