import os
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class StartRequest(BaseModel):
    task_name: str = Field(default="demo-task", min_length=1, max_length=100)
    total_steps: int = Field(default=20, ge=1, le=5000)
    interval_seconds: float = Field(default=1.0, ge=0.1, le=60.0)


class StartResponse(BaseModel):
    ok: bool
    run_id: str
    message: str


class StopResponse(BaseModel):
    ok: bool
    run_id: Optional[str] = None
    message: str


class TaskResult(BaseModel):
    run_id: str
    step: int
    total_steps: int
    task_name: str
    message: str
    created_at: str


class StatusResponse(BaseModel):
    state: Literal["idle", "running", "completed", "stopped", "failed"]
    run_id: Optional[str]
    task_name: Optional[str]
    progress: int
    total_steps: int
    started_at: Optional[str]
    finished_at: Optional[str]
    updated_at: str
    last_error: Optional[str]


class TaskManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        self.state: Literal["idle", "running", "completed", "stopped", "failed"] = "idle"
        self.run_id: Optional[str] = None
        self.task_name: Optional[str] = None
        self.progress = 0
        self.total_steps = 0
        self.started_at: Optional[str] = None
        self.finished_at: Optional[str] = None
        self.updated_at: str = utc_now_iso()
        self.last_error: Optional[str] = None
        self.results: List[TaskResult] = []

    def _set_state(self, state: Literal["idle", "running", "completed", "stopped", "failed"]) -> None:
        self.state = state
        self.updated_at = utc_now_iso()

    def start(self, payload: StartRequest) -> str:
        with self._lock:
            if self.state == "running":
                raise RuntimeError("Task is already running")

            self._stop_event.clear()
            self.run_id = str(uuid.uuid4())
            self.task_name = payload.task_name
            self.progress = 0
            self.total_steps = payload.total_steps
            self.started_at = utc_now_iso()
            self.finished_at = None
            self.last_error = None
            self.results = []
            self._set_state("running")

            self._thread = threading.Thread(
                target=self._worker,
                args=(self.run_id, payload.task_name, payload.total_steps, payload.interval_seconds),
                daemon=True,
            )
            self._thread.start()
            return self.run_id

    def stop(self) -> Optional[str]:
        with self._lock:
            current_run = self.run_id
            if self.state != "running":
                return current_run
            self._stop_event.set()
            return current_run

    def _worker(self, run_id: str, task_name: str, total_steps: int, interval_seconds: float) -> None:
        try:
            for step in range(1, total_steps + 1):
                if self._stop_event.is_set():
                    with self._lock:
                        self.finished_at = utc_now_iso()
                        self._set_state("stopped")
                    return

                time.sleep(interval_seconds)

                with self._lock:
                    self.progress = step
                    self.results.append(
                        TaskResult(
                            run_id=run_id,
                            step=step,
                            total_steps=total_steps,
                            task_name=task_name,
                            message=f"Completed step {step}/{total_steps}",
                            created_at=utc_now_iso(),
                        )
                    )
                    self.updated_at = utc_now_iso()

            with self._lock:
                self.finished_at = utc_now_iso()
                self._set_state("completed")

        except Exception as error:
            with self._lock:
                self.last_error = str(error)
                self.finished_at = utc_now_iso()
                self._set_state("failed")

    def status(self) -> StatusResponse:
        with self._lock:
            return StatusResponse(
                state=self.state,
                run_id=self.run_id,
                task_name=self.task_name,
                progress=self.progress,
                total_steps=self.total_steps,
                started_at=self.started_at,
                finished_at=self.finished_at,
                updated_at=self.updated_at,
                last_error=self.last_error,
            )

    def latest_results(self, limit: int = 200) -> List[TaskResult]:
        with self._lock:
            return list(self.results[-limit:])


app = FastAPI(title="Generic Task Panel API", version="1.0.0")
manager = TaskManager()

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
ADMIN_HTML_PATH = os.path.join(STATIC_DIR, "admin.html")

if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

api_bearer_token = os.getenv("API_BEARER_TOKEN", "").strip()
raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
allow_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_bearer_token(authorization: Optional[str] = Header(default=None)) -> None:
    if not api_bearer_token:
        return

    expected = f"Bearer {api_bearer_token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/")
def admin_ui() -> FileResponse:
    if not os.path.isfile(ADMIN_HTML_PATH):
        raise HTTPException(status_code=500, detail="Admin UI not found")
    return FileResponse(ADMIN_HTML_PATH)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "generic-task-panel-api", "timestamp": utc_now_iso()}


@app.post("/start", response_model=StartResponse, dependencies=[Depends(verify_bearer_token)])
def start_task(payload: StartRequest) -> StartResponse:
    try:
        run_id = manager.start(payload)
        return StartResponse(ok=True, run_id=run_id, message="Task started")
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/stop", response_model=StopResponse, dependencies=[Depends(verify_bearer_token)])
def stop_task() -> StopResponse:
    run_id = manager.stop()
    if manager.state != "running":
        return StopResponse(ok=True, run_id=run_id, message="No running task")
    return StopResponse(ok=True, run_id=run_id, message="Stop signal sent")


@app.get("/status", response_model=StatusResponse, dependencies=[Depends(verify_bearer_token)])
def get_status() -> StatusResponse:
    return manager.status()


@app.get("/results", response_model=List[TaskResult], dependencies=[Depends(verify_bearer_token)])
def get_results(limit: int = 200) -> List[TaskResult]:
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 1000")
    return manager.latest_results(limit=limit)
