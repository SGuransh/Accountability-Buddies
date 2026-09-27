# Accountability Buddies

The repository is split into two application boundaries:

- `frontend/` contains the Next.js app, UI components, browser-facing logic, and frontend dependencies.
- `backend/` is reserved for authentication, API, database, and server-side domain logic.

## Frontend

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

To create a production build:

```powershell
cd frontend
npm run build
npm run start
```

The current frontend still uses local demo state. Supabase authentication and the shared backend are planned for the next implementation phase.