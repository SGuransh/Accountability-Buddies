from datetime import date, timedelta
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import SessionLocal, get_db, init_database
from .models import EventModel, HabitCompletionModel, HabitModel, TaskModel
from .schemas import (
    DashboardResponse,
    EventCreate,
    EventItem,
    Habit,
    HabitCreate,
    HabitUpdate,
    KanbanTask,
    TaskCreate,
    TaskUpdate,
)

app = FastAPI(title="Accountability Buddies API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_database()


def habit_response(model: HabitModel, done: bool | None = None) -> Habit:
    return Habit(id=model.id, name=model.name, icon=model.icon, color=model.color, streak=model.streak, done=model.done if done is None else done, frequency=model.frequency)


def task_response(model: TaskModel) -> KanbanTask:
    return KanbanTask(id=model.id, title=model.title, tag=model.tag, priority=model.priority, column=model.column)


def event_response(model: EventModel) -> EventItem:
    return EventItem(id=model.id, title=model.title, date=model.date, time=model.time, color=model.color)


def completion_percentage(
    habits: list[HabitModel],
    completions: dict[int, set[date]],
    period_start: date,
    period_end: date,
) -> float:
    expected = 0
    completed = 0
    for habit in habits:
        if habit.frequency != "daily":
            continue
        habit_start = max(period_start, habit.created_at.date())
        if habit_start > period_end:
            continue
        expected += (period_end - habit_start).days + 1
        completed += sum(
            period_start <= completion_date <= period_end
            for completion_date in completions.get(habit.id, set())
        )
    return round((completed / expected) * 100, 2) if expected else 0.0


@app.get("/health")
def health(database: Session = Depends(get_db)) -> dict[str, str]:
    return {"status": "ok", "database": "connected"}


@app.get("/api/dashboard", response_model=DashboardResponse)
def get_dashboard(current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> DashboardResponse:
    habits = list(database.scalars(select(HabitModel).where(HabitModel.profile_id == current_user).order_by(HabitModel.id)))
    tasks = list(database.scalars(select(TaskModel).where(TaskModel.profile_id == current_user).order_by(TaskModel.id)))
    events = list(database.scalars(select(EventModel).where(EventModel.profile_id == current_user).order_by(EventModel.date, EventModel.id)))
    today = date.today()
    current_week_start = today - timedelta(days=today.weekday())
    previous_week_start = current_week_start - timedelta(days=7)
    completions = database.scalars(
        select(HabitCompletionModel).where(
            HabitCompletionModel.profile_id == current_user,
            HabitCompletionModel.completion_date >= previous_week_start,
            HabitCompletionModel.completion_date <= today,
        )
    )
    completion_dates: dict[int, set[date]] = {}
    for completion in completions:
        completion_dates.setdefault(completion.habit_id, set()).add(completion.completion_date)
    today_completions = {habit_id for habit_id, dates in completion_dates.items() if today in dates}
    return DashboardResponse(
        habits=[habit_response(item, item.id in today_completions) for item in habits],
        tasks=[task_response(item) for item in tasks],
        events=[event_response(item) for item in events],
        weekly_completion=completion_percentage(habits, completion_dates, current_week_start, today),
        previous_week_completion=completion_percentage(habits, completion_dates, previous_week_start, current_week_start - timedelta(days=1)),
    )


@app.get("/api/habits", response_model=list[Habit])
def list_habits(current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> list[Habit]:
    habits = list(database.scalars(select(HabitModel).where(HabitModel.profile_id == current_user).order_by(HabitModel.id)))
    today = date.today()
    today_completions = set(database.scalars(select(HabitCompletionModel.habit_id).where(HabitCompletionModel.profile_id == current_user, HabitCompletionModel.completion_date == today)))
    return [habit_response(item, item.id in today_completions) for item in habits]


@app.post("/api/habits", response_model=Habit, status_code=201)
def create_habit(payload: HabitCreate, current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> Habit:
    habit = HabitModel(profile_id=current_user, name=payload.name, icon=payload.icon, color=payload.color, frequency=payload.frequency)
    database.add(habit)
    database.commit()
    database.refresh(habit)
    return habit_response(habit)


@app.patch("/api/habits/{habit_id}", response_model=Habit)
def update_habit(habit_id: int, payload: HabitUpdate, current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> Habit:
    habit = database.scalar(select(HabitModel).where(HabitModel.id == habit_id, HabitModel.profile_id == current_user))
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    changes = payload.model_dump(exclude_unset=True)
    today = date.today()
    completion = database.scalar(
        select(HabitCompletionModel).where(
            HabitCompletionModel.habit_id == habit.id,
            HabitCompletionModel.profile_id == current_user,
            HabitCompletionModel.completion_date == today,
        )
    )
    if changes.get("done") is True and completion is None:
        habit.streak += 1
        database.add(HabitCompletionModel(habit_id=habit.id, profile_id=current_user, completion_date=today))
    elif changes.get("done") is False and completion is not None:
        habit.streak = max(0, habit.streak - 1)
        database.delete(completion)
    for field, value in changes.items():
        setattr(habit, field, value)
    database.commit()
    database.refresh(habit)
    return habit_response(habit)


@app.get("/api/tasks", response_model=list[KanbanTask])
def list_tasks(current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> list[KanbanTask]:
    return [task_response(item) for item in database.scalars(select(TaskModel).where(TaskModel.profile_id == current_user).order_by(TaskModel.id))]


@app.post("/api/tasks", response_model=KanbanTask, status_code=201)
def create_task(payload: TaskCreate, current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> KanbanTask:
    task = TaskModel(profile_id=current_user, **payload.model_dump())
    database.add(task)
    database.commit()
    database.refresh(task)
    return task_response(task)


@app.patch("/api/tasks/{task_id}", response_model=KanbanTask)
def update_task(task_id: int, payload: TaskUpdate, current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> KanbanTask:
    return apply_task_update(task_id, payload, current_user, database)


def apply_task_update(task_id: int, payload: TaskUpdate, current_user: UUID, database: Session) -> KanbanTask:
    task = database.scalar(select(TaskModel).where(TaskModel.id == task_id, TaskModel.profile_id == current_user))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    database.commit()
    database.refresh(task)
    return task_response(task)


@app.patch("/api/tasks/{task_id}/move", response_model=KanbanTask)
def move_task(task_id: int, payload: TaskUpdate, current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> KanbanTask:
    if payload.column is None:
        raise HTTPException(status_code=422, detail="column is required")
    return apply_task_update(task_id, TaskUpdate(column=payload.column), current_user, database)


@app.get("/api/events", response_model=list[EventItem])
def list_events(current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> list[EventItem]:
    return [event_response(item) for item in database.scalars(select(EventModel).where(EventModel.profile_id == current_user).order_by(EventModel.date, EventModel.id))]


@app.post("/api/events", response_model=EventItem, status_code=201)
def create_event(payload: EventCreate, current_user: UUID = Depends(get_current_user), database: Session = Depends(get_db)) -> EventItem:
    event = EventModel(profile_id=current_user, **payload.model_dump())
    database.add(event)
    database.commit()
    database.refresh(event)
    return event_response(event)
