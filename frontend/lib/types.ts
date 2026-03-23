export type TaskState = "idle" | "running" | "completed" | "stopped" | "failed";

export interface StartRequest {
  task_name: string;
  total_steps: number;
  interval_seconds: number;
}

export interface StartResponse {
  ok: boolean;
  run_id: string;
  message: string;
}

export interface StopResponse {
  ok: boolean;
  run_id?: string | null;
  message: string;
}

export interface StatusResponse {
  state: TaskState;
  run_id?: string | null;
  task_name?: string | null;
  progress: number;
  total_steps: number;
  started_at?: string | null;
  finished_at?: string | null;
  updated_at: string;
  last_error?: string | null;
}

export interface TaskResult {
  run_id: string;
  step: number;
  total_steps: number;
  task_name: string;
  message: string;
  created_at: string;
}
