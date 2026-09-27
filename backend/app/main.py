from datetime import date

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal, get_db, init_database
from .models import EventModel, HabitModel, TaskModel
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
    database = SessionLocal()
    try:
        seed_database(database)
    finally:
        database.close()


def habit_response(model: HabitModel) -> Habit:
    return Habit(id=model.id, name=model.name, icon=model.icon, color=model.color, streak=model.streak, done=model.done, frequency=model.frequency)


def task_response(model: TaskModel) -> KanbanTask:
    return KanbanTask(id=model.id, title=model.title, tag=model.tag, priority=model.priority, column=model.column)


def event_response(model: EventModel) -> EventItem:
    return EventItem(id=model.id, title=model.title, date=model.date, time=model.time, color=model.color)


def seed_database(database: Session) -> None:
    if not database.scalar(select(HabitModel.id).limit(1)):
        database.add_all([
            HabitModel(id=1, name="Morning test", icon="◌", color="mint", streak=12, done=True),
            HabitModel(id=2, name="Read 20 pages", icon="▤", color="violet", streak=8, done=False),
            HabitModel(id=3, name="Drink 8 glasses of water", icon="◒", color="blue", streak=5, done=False),
            HabitModel(id=4, name="Evening journal", icon="✎", color="orange", streak=21, done=False),
        ])
    if not database.scalar(select(TaskModel.id).limit(1)):
        database.add_all([
            TaskModel(id=1, title="Plan next week", tag="Personal", priority="High", column="To do"),
            TaskModel(id=2, title="Book dentist appointment", tag="Health", priority="Medium", column="To do"),
            TaskModel(id=3, title="Update portfolio", tag="Work", priority="High", column="In progress"),
            TaskModel(id=4, title="Organize photo library", tag="Personal", priority="Low", column="In progress"),
            TaskModel(id=5, title="Buy groceries", tag="Errands", priority="Medium", column="Done"),
        ])
    if not database.scalar(select(EventModel.id).limit(1)):
        database.add_all([
            EventModel(id=1, title="Team sync", date=date.today(), time="10:00", color="violet"),
            EventModel(id=2, title="Gym session", date=date.today(), time="18:30", color="mint"),
            EventModel(id=3, title="Project review", date=date.today(), time="14:00", color="orange"),
        ])
    database.commit()


@app.get("/health")
def health(database: Session = Depends(get_db)) -> dict[str, str]:
    seed_database(database)
    return {"status": "ok", "database": "connected"}


@app.get("/api/dashboard", response_model=DashboardResponse)
def get_dashboard(database: Session = Depends(get_db)) -> DashboardResponse:
    seed_database(database)
    return DashboardResponse(
        habits=[habit_response(item) for item in database.scalars(select(HabitModel).order_by(HabitModel.id))],
        tasks=[task_response(item) for item in database.scalars(select(TaskModel).order_by(TaskModel.id))],
        events=[event_response(item) for item in database.scalars(select(EventModel).order_by(EventModel.date, EventModel.id))],
    )


@app.get("/api/habits", response_model=list[Habit])
def list_habits(database: Session = Depends(get_db)) -> list[Habit]:
    seed_database(database)
    return [habit_response(item) for item in database.scalars(select(HabitModel).order_by(HabitModel.id))]


@app.post("/api/habits", response_model=Habit, status_code=201)
def create_habit(payload: HabitCreate, database: Session = Depends(get_db)) -> Habit:
    habit = HabitModel(name=payload.name, icon=payload.icon, color=payload.color, frequency=payload.frequency)
    database.add(habit)
    database.commit()
    database.refresh(habit)
    return habit_response(habit)


@app.patch("/api/habits/{habit_id}", response_model=Habit)
def update_habit(habit_id: int, payload: HabitUpdate, database: Session = Depends(get_db)) -> Habit:
    habit = database.get(HabitModel, habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("done") is True and not habit.done:
        habit.streak += 1
    if changes.get("done") is False and habit.done:
        habit.streak = max(0, habit.streak - 1)
    for field, value in changes.items():
        setattr(habit, field, value)
    database.commit()
    database.refresh(habit)
    return habit_response(habit)


@app.get("/api/tasks", response_model=list[KanbanTask])
def list_tasks(database: Session = Depends(get_db)) -> list[KanbanTask]:
    seed_database(database)
    return [task_response(item) for item in database.scalars(select(TaskModel).order_by(TaskModel.id))]


@app.post("/api/tasks", response_model=KanbanTask, status_code=201)
def create_task(payload: TaskCreate, database: Session = Depends(get_db)) -> KanbanTask:
    task = TaskModel(**payload.model_dump())
    database.add(task)
    database.commit()
    database.refresh(task)
    return task_response(task)


@app.patch("/api/tasks/{task_id}", response_model=KanbanTask)
def update_task(task_id: int, payload: TaskUpdate, database: Session = Depends(get_db)) -> KanbanTask:
    task = database.get(TaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    database.commit()
    database.refresh(task)
    return task_response(task)


@app.patch("/api/tasks/{task_id}/move", response_model=KanbanTask)
def move_task(task_id: int, payload: TaskUpdate, database: Session = Depends(get_db)) -> KanbanTask:
    if payload.column is None:
        raise HTTPException(status_code=422, detail="column is required")
    return update_task(task_id, TaskUpdate(column=payload.column), database)


@app.get("/api/events", response_model=list[EventItem])
def list_events(database: Session = Depends(get_db)) -> list[EventItem]:
    seed_database(database)
    return [event_response(item) for item in database.scalars(select(EventModel).order_by(EventModel.date, EventModel.id))]


@app.post("/api/events", response_model=EventItem, status_code=201)
def create_event(payload: EventCreate, database: Session = Depends(get_db)) -> EventItem:
    event = EventModel(**payload.model_dump())
    database.add(event)
    database.commit()
    database.refresh(event)
    return event_response(event)
