"use client";

import { useEffect, useState } from "react";
import {
  clearDoneTasks as clearDoneTasksApi,
  createEvent as createEventApi,
  createHabit as createHabitApi,
  createTask as createTaskApi,
  deleteHabit as deleteHabitApi,
  fetchDashboard,
  moveTask as moveTaskApi,
  updateHabit as updateHabitApi,
} from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Flame,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  Sun,
  Target,
  Trash2,
  X,
} from "lucide-react";

type Habit = {
  id: number;
  name: string;
  icon: string;
  color: string;
  done: boolean;
};
type KanbanTask = {
  id: number;
  title: string;
  tag: string;
  priority: "High" | "Medium" | "Low";
  column: string;
};
type EventItem = {
  id: number;
  title: string;
  date: string;
  time: string;
  color: string;
};

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const habitIconOptions = ["◌", "▤", "◒", "✎", "★", "♥"];
const habitColorOptions = [
  { name: "mint", className: "bg-[#c9f5d6]" },
  { name: "violet", className: "bg-[#dcd3fa]" },
  { name: "blue", className: "bg-[#c9e5f4]" },
  { name: "orange", className: "bg-[#f8d8bd]" },
];
const taskTagOptions = ["Personal", "Health", "Work", "Errands"];
const taskPriorityOptions = ["Low", "Medium", "High"] as const;
const eventColorOptions = [
  { name: "blue", className: "bg-[#c9e5f4]" },
  { name: "mint", className: "bg-[#c9f5d6]" },
  { name: "violet", className: "bg-[#dcd3fa]" },
  { name: "orange", className: "bg-[#f8d8bd]" },
];

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatHeaderDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);

const formatMonthLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);

const getCalendarDays = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstDay.getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      month.getFullYear(),
      month.getMonth(),
      index - startOffset + 1,
    );
    return { date, currentMonth: date.getMonth() === month.getMonth() };
  });
};

export default function Page() {
  const router = useRouter();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [weeklyCompletion, setWeeklyCompletion] = useState(0);
  const [previousWeekCompletion, setPreviousWeekCompletion] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [personalBest, setPersonalBest] = useState(0);
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [viewMonth, setViewMonth] = useState(() => {
    const currentDate = new Date();
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() =>
    formatDateInput(new Date()),
  );
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState(() => ({
    title: "",
    date: formatDateInput(new Date()),
    time: "09:00",
  }));
  const [newEventColor, setNewEventColor] = useState(eventColorOptions[0].name);
  const [newHabit, setNewHabit] = useState("");
  const [newHabitIcon, setNewHabitIcon] = useState(habitIconOptions[0]);
  const [newHabitColor, setNewHabitColor] = useState(habitColorOptions[0].name);
  const [showHabitInput, setShowHabitInput] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newTaskTag, setNewTaskTag] = useState(taskTagOptions[0]);
  const [newTaskPriority, setNewTaskPriority] =
    useState<(typeof taskPriorityOptions)[number]>("Medium");
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("there");
  const [initials, setInitials] = useState("DB");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("daymark-theme");
    setDarkMode(savedTheme === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("daymark-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const logOut = async () => {
    await getSupabaseClient().auth.signOut();
    router.replace("/login");
  };

  useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      try {
        const dashboard = await fetchDashboard();
        if (cancelled) return;
        const name = dashboard.display_name.trim() || "there";
        setDisplayName(name);
        setInitials(
          name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        );
        setHabits(dashboard.habits);
        setTasks(dashboard.tasks);
        setEvents(dashboard.events);
        setWeeklyCompletion(dashboard.weekly_completion);
        setPreviousWeekCompletion(dashboard.previous_week_completion);
        setCurrentStreak(dashboard.current_streak);
        setPersonalBest(dashboard.personal_best);
        setCompletedDates(dashboard.completed_dates);
      } catch (error) {
        if (cancelled) return;
        setApiError(
          error instanceof Error
            ? error.message
            : "The backend is unavailable.",
        );
      }
    };
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);
  const completed = habits.filter((habit) => habit.done).length;
  const currentDate = new Date();
  const monthLabel = formatMonthLabel(viewMonth);
  const calendarDays = getCalendarDays(viewMonth);
  const toggleHabit = async (id: number) => {
    const habit = habits.find((item) => item.id === id);
    if (!habit) return;
    const done = !habit.done;
    try {
      const updated = await updateHabitApi(id, done);
      setHabits((current) => current.map((item) => (item.id === id ? updated : item)));
      const dashboard = await fetchDashboard();
      setWeeklyCompletion(dashboard.weekly_completion);
      setPreviousWeekCompletion(dashboard.previous_week_completion);
      setCurrentStreak(dashboard.current_streak);
      setPersonalBest(dashboard.personal_best);
      setCompletedDates(dashboard.completed_dates);
      setApiError(null);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to update habit.",
      );
    }
  };
  const addHabit = async () => {
    if (!newHabit.trim()) return;
    try {
      const created = await createHabitApi({
        name: newHabit.trim(),
        icon: newHabitIcon,
        color: newHabitColor,
      });
      const dashboard = await fetchDashboard();
      setHabits(dashboard.habits);
      setWeeklyCompletion(dashboard.weekly_completion);
      setPreviousWeekCompletion(dashboard.previous_week_completion);
      setCurrentStreak(dashboard.current_streak);
      setPersonalBest(dashboard.personal_best);
      setCompletedDates(dashboard.completed_dates);
      setApiError(null);
      setNewHabit("");
      setNewHabitIcon(habitIconOptions[0]);
      setNewHabitColor(habitColorOptions[0].name);
      setShowHabitInput(false);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to create habit.",
      );
    }
  };
  const deleteHabit = async (id: number) => {
    if (!window.confirm("Delete this habit and its completion history?")) return;
    try {
      await deleteHabitApi(id);
      const dashboard = await fetchDashboard();
      setHabits(dashboard.habits);
      setWeeklyCompletion(dashboard.weekly_completion);
      setPreviousWeekCompletion(dashboard.previous_week_completion);
      setCurrentStreak(dashboard.current_streak);
      setPersonalBest(dashboard.personal_best);
      setCompletedDates(dashboard.completed_dates);
      setApiError(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to delete habit.");
    }
  };
  const openEventForm = (date = selectedDate) => {
    setSelectedDate(date);
    setNewEvent((current) => ({ ...current, date }));
    setShowEventForm(true);
  };
  const addEvent = async () => {
    if (!newEvent.title.trim()) return;
    const input = {
      title: newEvent.title,
      date: newEvent.date,
      time: newEvent.time,
      color: newEventColor,
    };
    try {
      const created = await createEventApi(input);
      setEvents((current) => [...current, created]);
      setApiError(null);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to create event.",
      );
    }
    setNewEvent({
      title: "",
      date: formatDateInput(new Date()),
      time: "09:00",
    });
    setNewEventColor(eventColorOptions[0].name);
    setShowEventForm(false);
  };
  const addTask = async () => {
    if (!newTask.trim()) return;
    const input = {
      title: newTask.trim(),
      tag: newTaskTag,
      priority: newTaskPriority,
      column: "To do" as const,
    };
    try {
      const created = await createTaskApi(input);
      setTasks((current) => [...current, created]);
      setApiError(null);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to create task.",
      );
    }
    setNewTask("");
    setNewTaskTag(taskTagOptions[0]);
    setNewTaskPriority("Medium");
    setShowTaskInput(false);
  };
  const moveTask = async (taskId: number, column: string) => {
    try {
      const updated = await moveTaskApi(
        taskId,
        column as "To do" | "In progress" | "Done",
      );
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );
      setApiError(null);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to move task.",
      );
    }
    setDraggedTaskId(null);
  };
  const clearDoneTasks = async () => {
    const doneCount = tasks.filter((task) => task.column === "Done").length;
    if (!doneCount || !window.confirm(`Clear ${doneCount} completed task${doneCount === 1 ? "" : "s"}?`)) return;
    try {
      await clearDoneTasksApi();
      setTasks((current) => current.filter((task) => task.column !== "Done"));
      setApiError(null);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to clear completed tasks.",
      );
    }
  };
  const columns = ["To do", "In progress", "Done"];

  return (
    <main className={`dashboard-shell min-h-screen bg-[#f7f8fa] text-[#18212b]${darkMode ? " dark-mode" : ""}`}>
      <div className="flex min-h-screen">
        <aside className="hidden w-[238px] shrink-0 border-r border-[#e6e9ee] bg-white px-5 py-7 lg:block">
          <div className="mb-12 flex items-center gap-2.5 px-2">
            <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#c9f5d6] text-[#268249]">
              <Sparkles size={17} strokeWidth={2.5} />
            </div>
            <span className="text-[17px] font-bold tracking-[-0.03em]">
              daymark
            </span>
          </div>
          <div className="my-8 h-px bg-[#edf0f2]" />
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a4acb5]">
            Workspace
          </p>
          <nav className="mt-3 space-y-1">
            <button className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-[#78818d] hover:bg-[#f4f6f8]">
              <Settings2 size={17} /> Settings
            </button>
            <button className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-[#78818d] hover:bg-[#f4f6f8]">
              <Bell size={17} /> Notifications
            </button>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-[#e6e9ee] bg-white px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button className="lg:hidden">
                <Menu size={21} />
              </button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#a0a8b1]">
                  {formatHeaderDate(currentDate)}
                </p>
                <h1 className="mt-1 text-[21px] font-bold tracking-[-0.04em]">
                  Mudd Gorningg, {displayName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDarkMode((current) => !current)}
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                className="flex size-9 items-center justify-center rounded-lg border border-[#e1e6e9] text-[#53616b] transition hover:bg-[#f4f6f8]"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                type="button"
                onClick={logOut}
                className="flex items-center gap-2 rounded-lg border border-[#e1e6e9] px-3 py-2 text-[12px] font-semibold text-[#53616b] hover:bg-[#f6f8f8]"
              >
                <LogOut size={15} />
                Log out
              </button>
              <div className="ml-1 flex size-8 items-center justify-center rounded-full bg-[#e9d5c6] text-[11px] font-bold text-[#744932]">
                {initials}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1390px] px-5 py-7 sm:px-8 lg:px-10">
            {apiError && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-[#f0c7c0] bg-[#fff5f2] px-4 py-3 text-[12px] font-medium text-[#a04c40]"
              >
                Backend connection error: {apiError}
              </div>
            )}
            <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat
                icon={<CheckCircle2 size={18} />}
                label="Today's progress"
                value={`${completed}/${habits.length}`}
                note="habits completed"
                color="mint"
              />
              <Stat
                icon={<Flame size={18} />}
                label="Current streak"
                value={`${currentStreak} days`}
                note={`personal best: ${personalBest}`}
                color="orange"
              />
              <Stat
                icon={<Target size={18} />}
                label="Weekly completion"
                value={`${Math.round(weeklyCompletion)}%`}
                note={`${Math.round(previousWeekCompletion)}% last week`}
                color="violet"
              />
              <Stat
                icon={<CalendarDays size={18} />}
                label="Upcoming events"
                value={String(events.length)}
                note="next 7 days"
                color="blue"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,0.75fr)]">
              <section className="rounded-2xl border border-[#e5e9ed] bg-white p-5 shadow-[0_2px_12px_rgba(29,42,53,0.025)] sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold tracking-[-0.02em]">
                      Your daily habits
                    </h2>
                    <p className="mt-1 text-[12px] text-[#89939c]">
                      Small steps, consistent progress.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowHabitInput(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e1e6e9] px-3 py-2 text-[12px] font-semibold text-[#53616b] hover:bg-[#f6f8f8]"
                  >
                    <Plus size={14} /> Add habit
                  </button>
                </div>
                {showHabitInput && (
                  <div className="mb-4 space-y-3 rounded-xl bg-[#f6f9f7] p-3">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newHabit}
                        onChange={(e) => setNewHabit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addHabit();
                        }}
                        placeholder="Name your daily habit"
                        className="min-w-0 flex-1 rounded-lg border border-[#dfe5e1] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#65bd7b]"
                      />
                      <button
                        onClick={addHabit}
                        className="rounded-lg bg-[#65bd7b] px-3 text-[12px] font-bold text-white"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowHabitInput(false)}
                        className="rounded-lg border px-2 text-[#82909a]"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#697680]">
                      <span className="font-semibold">Icon</span>
                      {habitIconOptions.map((icon) => (
                        <button
                          type="button"
                          key={icon}
                          aria-label={`Choose ${icon} habit icon`}
                          onClick={() => setNewHabitIcon(icon)}
                          className={`flex size-7 items-center justify-center rounded-lg border text-base ${newHabitIcon === icon ? "border-[#59be75] bg-[#eaf9ef]" : "border-[#e1e6e9] bg-white hover:bg-[#f6f8f8]"}`}
                        >
                          {icon}
                        </button>
                      ))}
                      <span className="ml-2 font-semibold">Color</span>
                      {habitColorOptions.map((color) => (
                        <button
                          type="button"
                          key={color.name}
                          aria-label={`Choose ${color.name} habit color`}
                          onClick={() => setNewHabitColor(color.name)}
                          className={`size-6 rounded-full border-2 ${color.className} ${newHabitColor === color.name ? "border-[#268249] ring-2 ring-[#c9f5d6]" : "border-white"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2.5">
                  {habits.map((habit) => (
                    <div
                      key={habit.id}
                      className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${habit.done ? "border-[#dcefe1] bg-[#f6fcf7]" : "border-[#edf0f2] bg-white hover:border-[#dce4df]"}`}
                    >
                      <button
                        aria-label={`Mark ${habit.name} ${habit.done ? "incomplete" : "complete"}`}
                        onClick={() => toggleHabit(habit.id)}
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition ${habit.done ? "border-[#59be75] bg-[#59be75] text-white" : "border-[#cbd3d5] text-transparent hover:border-[#59be75]"}`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </button>
                      <div
                        className={`flex size-8 items-center justify-center rounded-lg text-[16px] ${habit.color === "mint" ? "bg-[#e4f7e9] text-[#47a667]" : habit.color === "violet" ? "bg-[#eeeafd] text-[#8773ce]" : habit.color === "blue" ? "bg-[#e4f1fa] text-[#5995ba]" : "bg-[#fff0e5] text-[#d9935c]"}`}
                      >
                        {habit.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-[13px] font-semibold ${habit.done ? "text-[#62836d] line-through decoration-[#9fc9aa]" : "text-[#33404b]"}`}
                        >
                          {habit.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${habit.name}`}
                        title="Delete habit"
                        onClick={() => deleteHabit(habit.id)}
                        className="ml-1 text-[#c1c8cd] opacity-0 transition group-hover:opacity-100 hover:text-[#b75b50]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-[#f0f2f3] pt-4">
                  <span className="text-[11px] font-medium text-[#9aa3aa]">
                    Today's completion
                  </span>
                  <span className="text-[12px] font-bold text-[#399259]">
                    {Math.round((completed / habits.length) * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#edf2ee]">
                  <div
                    className="h-full rounded-full bg-[#67c77f] transition-all"
                    style={{ width: `${(completed / habits.length) * 100}%` }}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-[#e5e9ed] bg-white p-5 shadow-[0_2px_12px_rgba(29,42,53,0.025)] sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold tracking-[-0.02em]">
                      This month
                    </h2>
                    <p className="mt-1 text-[12px] text-[#89939c]">
                      Keep your rhythm going.
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label="Previous month"
                      onClick={() =>
                        setViewMonth(
                          (current) =>
                            new Date(
                              current.getFullYear(),
                              current.getMonth() - 1,
                              1,
                            ),
                        )
                      }
                      className="rounded-md p-1.5 text-[#89939c] hover:bg-[#f2f5f3]"
                    >
                      <ArrowLeft size={15} />
                    </button>
                    <button
                      aria-label="Next month"
                      onClick={() =>
                        setViewMonth(
                          (current) =>
                            new Date(
                              current.getFullYear(),
                              current.getMonth() + 1,
                              1,
                            ),
                        )
                      }
                      className="rounded-md p-1.5 text-[#89939c] hover:bg-[#f2f5f3]"
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
                <div className="mb-3">
                  <span className="text-[13px] font-bold">{monthLabel}</span>
                </div>
                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {days.map((day) => (
                    <div
                      key={day}
                      className="pb-2 text-[10px] font-bold uppercase tracking-wide text-[#a5adb4]"
                    >
                      {day.slice(0, 2)}
                    </div>
                  ))}
                  {calendarDays.map(({ date, currentMonth }) => {
                    const dateKey = formatDateInput(date);
                    const marked = currentMonth && completedDates.includes(dateKey);
                    const today = dateKey === formatDateInput(currentDate);
                    const selected = dateKey === selectedDate;
                    return (
                      <button
                        type="button"
                        key={dateKey}
                        aria-label={`Add event on ${formatHeaderDate(date)}`}
                        onClick={() => openEventForm(dateKey)}
                        className={`relative flex h-8 items-center justify-center text-[11px] ${!currentMonth ? "text-[#d2d7da]" : today ? "font-bold text-white" : "text-[#697680]"} ${selected && !today ? "rounded-md bg-[#f0f8f2] ring-1 ring-[#8bc99a]" : ""}`}
                      >
                        <span
                          className={`${today ? "flex size-7 items-center justify-center rounded-full bg-[#59bd73]" : marked ? "flex size-7 items-center justify-center rounded-full bg-[#eff9f1] text-[#4b9f61]" : ""}`}
                        >
                          {date.getDate()}
                        </span>
                        {marked && !today && (
                          <i className="absolute bottom-0.5 size-1 rounded-full bg-[#66c47c]" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex gap-4 border-t border-[#f0f2f3] pt-4 text-[10px] text-[#9ba4aa]">
                  <span className="flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-[#67c77f]" /> Habit
                    completed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-[#d9dfe1]" /> Rest day
                  </span>
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,0.75fr)]">
              <section className="rounded-2xl border border-[#e5e9ed] bg-white p-5 shadow-[0_2px_12px_rgba(29,42,53,0.025)] sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold tracking-[-0.02em]">
                      Kanban board
                    </h2>
                    <p className="mt-1 text-[12px] text-[#89939c]">
                      Move tasks forward, one step at a time.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTaskInput(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#24322d] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#31443a]"
                    >
                      <Plus size={14} /> New task
                    </button>
                    {tasks.some((task) => task.column === "Done") && (
                      <button
                        type="button"
                        onClick={clearDoneTasks}
                        className="flex items-center gap-1.5 rounded-lg border border-[#e1e6e9] px-3 py-2 text-[12px] font-semibold text-[#8d6259] hover:bg-[#fff7f5]"
                      >
                        <Trash2 size={14} /> Clear done
                      </button>
                    )}
                  </div>
                </div>
                {showTaskInput && (
                  <div className="mb-4 space-y-3 rounded-xl bg-[#f6f9f7] p-3">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addTask();
                        }}
                        placeholder="What needs doing?"
                        className="min-w-0 flex-1 rounded-lg border border-[#dfe5e1] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#65bd7b]"
                      />
                      <button
                        onClick={addTask}
                        className="rounded-lg bg-[#65bd7b] px-3 text-[12px] font-bold text-white"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowTaskInput(false)}
                        className="rounded-lg border px-2 text-[#82909a]"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#697680]">
                      <label className="font-semibold" htmlFor="task-tag">
                        Tag
                      </label>
                      <select
                        id="task-tag"
                        value={newTaskTag}
                        onChange={(event) => setNewTaskTag(event.target.value)}
                        className="rounded-lg border border-[#e1e6e9] bg-white px-2 py-1.5 text-[11px]"
                      >
                        {taskTagOptions.map((tag) => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </select>
                      <label className="font-semibold" htmlFor="task-priority">
                        Priority
                      </label>
                      <select
                        id="task-priority"
                        value={newTaskPriority}
                        onChange={(event) =>
                          setNewTaskPriority(
                            event.target.value as (typeof taskPriorityOptions)[number],
                          )
                        }
                        className="rounded-lg border border-[#e1e6e9] bg-white px-2 py-1.5 text-[11px]"
                      >
                        {taskPriorityOptions.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-3">
                  {columns.map((column) => (
                    <div key={column} className="min-w-0">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i
                            className={`size-2 rounded-full ${column === "To do" ? "bg-[#b2bbc1]" : column === "In progress" ? "bg-[#e5b660]" : "bg-[#65c37c]"}`}
                          />
                          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7d8991]">
                            {column}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#b3bbc1]">
                          {tasks.filter((t) => t.column === column).length}
                        </span>
                      </div>
                      <div
                        className="min-h-16 space-y-2 rounded-xl transition"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() =>
                          draggedTaskId !== null &&
                          moveTask(draggedTaskId, column)
                        }
                      >
                        {tasks
                          .filter((t) => t.column === column)
                          .map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={() => setDraggedTaskId(task.id)}
                              onDragEnd={() => setDraggedTaskId(null)}
                              className={`cursor-grab rounded-xl border border-[#edf0f1] bg-[#fbfcfc] p-3 active:cursor-grabbing ${draggedTaskId === task.id ? "opacity-50" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[12px] font-semibold leading-4 text-[#45525b]">
                                  {task.title}
                                </p>
                                <button
                                  aria-label={`Move ${task.title}`}
                                  onClick={() =>
                                    moveTask(
                                      task.id,
                                      column === "To do"
                                        ? "In progress"
                                        : column === "In progress"
                                          ? "Done"
                                          : "To do",
                                    )
                                  }
                                  className="shrink-0 text-[#c2c9ce] hover:text-[#718079]"
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="rounded bg-[#eef4f1] px-1.5 py-0.5 text-[9px] font-semibold text-[#75877c]">
                                  {task.tag}
                                </span>
                                <span
                                  className={`text-[9px] font-bold ${task.priority === "High" ? "text-[#d77d69]" : task.priority === "Medium" ? "text-[#c3984e]" : "text-[#8b9ba2]"}`}
                                >
                                  {task.priority}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#e5e9ed] bg-white p-5 shadow-[0_2px_12px_rgba(29,42,53,0.025)] sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold tracking-[-0.02em]">
                      Upcoming events
                    </h2>
                    <p className="mt-1 text-[12px] text-[#89939c]">
                      A clear view of what's ahead.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEventForm(!showEventForm)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e1e6e9] px-3 py-2 text-[12px] font-semibold text-[#53616b] hover:bg-[#f6f8f8]"
                  >
                    <Plus size={14} /> Add event
                  </button>
                </div>
                {showEventForm && (
                  <div className="mb-4 space-y-2 rounded-xl bg-[#f6f9f7] p-3">
                    <input
                      value={newEvent.title}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, title: e.target.value })
                      }
                      placeholder="Event title"
                      className="w-full rounded-lg border border-[#dfe5e1] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#65bd7b]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newEvent.date}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, date: e.target.value })
                        }
                        className="min-w-0 flex-1 rounded-lg border border-[#dfe5e1] bg-white px-2 py-2 text-[11px]"
                      />
                      <input
                        type="time"
                        value={newEvent.time}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, time: e.target.value })
                        }
                        className="rounded-lg border border-[#dfe5e1] bg-white px-2 py-2 text-[11px]"
                      />
                      <button
                        onClick={addEvent}
                        className="rounded-lg bg-[#65bd7b] px-3 text-[12px] font-bold text-white"
                      >
                        Save
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#697680]">
                      <span className="font-semibold">Color</span>
                      {eventColorOptions.map((color) => (
                        <button
                          type="button"
                          key={color.name}
                          aria-label={`Choose ${color.name} event color`}
                          onClick={() => setNewEventColor(color.name)}
                          className={`size-6 rounded-full border-2 ${color.className} ${newEventColor === color.name ? "border-[#268249] ring-2 ring-[#c9f5d6]" : "border-white"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  {events
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(0, 4)
                    .map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-[#fafcfb]"
                      >
                        <div
                          className={`size-2 rounded-full ${event.color === "violet" ? "bg-[#9a85dc]" : event.color === "orange" ? "bg-[#e4a164]" : event.color === "mint" ? "bg-[#64c77e]" : "bg-[#70a9ca]"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-[#46535d]">
                            {event.title}
                          </p>
                          <p className="mt-1 text-[10px] text-[#a0a9ae]">
                            {event.date} · {event.time}
                          </p>
                        </div>
                        <CalendarDays size={15} className="text-[#c1c9cd]" />
                      </div>
                    ))}
                </div>
                <button className="mt-3 w-full rounded-lg border border-dashed border-[#dfe6e1] py-2.5 text-[11px] font-semibold text-[#6ca27a] hover:bg-[#f7fbf8]">
                  View full calendar
                </button>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e5e9ed] bg-white p-4 shadow-[0_2px_12px_rgba(29,42,53,0.025)] sm:p-5">
      <div className="flex items-start justify-between">
        <div
          className={`flex size-8 items-center justify-center rounded-lg ${color === "mint" ? "bg-[#e5f8ea] text-[#4daf69]" : color === "orange" ? "bg-[#fff1e5] text-[#d9945a]" : color === "violet" ? "bg-[#eeeafd] text-[#8874ca]" : "bg-[#e5f2fa] text-[#6099ba]"}`}
        >
          {icon}
        </div>
        <MoreHorizontal size={16} className="text-[#c8ced2]" />
      </div>
      <p className="mt-4 text-[11px] font-semibold text-[#89949c]">{label}</p>
      <p className="mt-1 text-[22px] font-bold tracking-[-0.05em] text-[#26343e]">
        {value}
      </p>
      <p className="mt-1 text-[10px] text-[#a7afb5]">{note}</p>
    </div>
  );
}
