# Backend

This directory owns server-side application logic for Accountability Buddies.

Planned responsibilities include authentication integration, buddy pairing, database access, authorization policies, and domain validation for habits, tasks, and schedule events.

The backend implementation will be added separately from the Next.js frontend so browser-facing UI code remains in `frontend/`.

## Run the mock API

From the repository root:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The interactive API documentation is available at `http://localhost:8000/docs`.

Current routes include:

- `GET /health`
- `GET /api/dashboard`
- `GET`, `POST`, and `PATCH /api/habits`
- `GET`, `POST`, and `PATCH /api/tasks`
- `PATCH /api/tasks/{task_id}/move`
- `GET` and `POST /api/events`

## Database

The API now uses SQLAlchemy persistence. By default it creates `backend/accountability.db` using SQLite, which is ignored by git. To use PostgreSQL or Supabase, set `DATABASE_URL` before starting the server, for example in `backend/.env`.

The current tables are `habits`, `tasks`, and `events`. Tables are created automatically on startup and the initial development rows are seeded only when each table is empty.
