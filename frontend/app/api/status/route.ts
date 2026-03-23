import { forwardToBackend } from "../_backend";

export async function GET(): Promise<Response> {
  return forwardToBackend("/status", {
    method: "GET",
  });
}
