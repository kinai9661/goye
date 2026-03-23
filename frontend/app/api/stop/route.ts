import { forwardToBackend } from "../_backend";

export async function POST(): Promise<Response> {
  return forwardToBackend("/stop", {
    method: "POST",
  });
}
