from datetime import date, datetime, time as time_type
from uuid import UUID

from sqlalchemy import Date, Integer, String, Time, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class HabitModel(Base):
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str] = mapped_column(String(16), default="◌")
    color: Mapped[str] = mapped_column(String(32), default="mint")
    streak: Mapped[int] = mapped_column(Integer, default=0)
    done: Mapped[bool] = mapped_column(default=False)
    frequency: Mapped[str] = mapped_column(String(16), default="daily")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class HabitCompletionModel(Base):
    __tablename__ = "habit_completions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    habit_id: Mapped[int] = mapped_column(Integer, index=True)
    profile_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    completion_date: Mapped[date] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class TaskModel(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    title: Mapped[str] = mapped_column(String(160))
    tag: Mapped[str] = mapped_column(String(64), default="Personal")
    priority: Mapped[str] = mapped_column(String(16), default="Medium")
    column: Mapped[str] = mapped_column("workflow_column", String(32), default="To do")


class EventModel(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    title: Mapped[str] = mapped_column(String(160))
    date: Mapped[date] = mapped_column(Date)
    time: Mapped[time_type] = mapped_column(Time, default=time_type(9, 0))
    color: Mapped[str] = mapped_column(String(32), default="blue")
