from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["High", "Medium", "Low"]
TaskColumn = Literal["To do", "In progress", "Done"]


class Habit(BaseModel):
    id: int
    name: str
    icon: str
    color: str
    streak: int
    done: bool
    frequency: Literal["daily"] = "daily"


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    icon: str = "◌"
    color: str = "mint"
    frequency: Literal["daily"] = "daily"


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    done: bool | None = None


class KanbanTask(BaseModel):
    id: int
    title: str
    tag: str
    priority: Priority
    column: TaskColumn


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    tag: str = "Personal"
    priority: Priority = "Medium"
    column: TaskColumn = "To do"


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    tag: str | None = None
    priority: Priority | None = None
    column: TaskColumn | None = None


class EventItem(BaseModel):
    id: int
    title: str
    date: date
    time: str
    color: str


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    date: date
    time: str = "09:00"
    color: str = "blue"


class DashboardResponse(BaseModel):
    habits: list[Habit]
    tasks: list[KanbanTask]
    events: list[EventItem]
