import { forwardToBackend } from "../_backend";

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  return forwardToBackend("/start", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
