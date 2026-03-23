import { forwardToBackend } from "../_backend";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") || "200";

  return forwardToBackend(`/results?limit=${encodeURIComponent(limit)}`, {
    method: "GET",
  });
}
