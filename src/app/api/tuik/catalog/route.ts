import { toApiLang, relay, sameOrigin, jsonError } from "@/lib/tuikProxy";

export async function GET(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "forbidden");
  return relay("/catalog", { lang: toApiLang(new URL(request.url).searchParams.get("lang")) });
}
