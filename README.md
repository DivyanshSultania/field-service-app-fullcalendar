# Field Service App (Starter Repo)

This is a minimal integrated starter repository (frontend + backend) for the Field Service application you specified.
It includes:
- backend: Express server with SQLite database (simple API endpoints for staff, clients, tasks)
- frontend: Vite + React app with a left sidebar and a simplified week calendar view that fetches tasks from the backend.

## How to run

You need Node.js (18+) installed.

1. Backend
```
cd backend
npm install
npm run seed   # optional: populates demo data via /api/seed
npm start
```
Backend will run on http://localhost:4000

2. Frontend
```
cd frontend
npm install
npm run dev
```
Frontend will run on    

## Notes
- The frontend fetches /api/staff and /api/tasks from http://localhost:4000. Make sure backend is running.
- This is a starter scaffold. You can extend the API and UI (modals, Google Places integration, TUI Calendar) as needed.
