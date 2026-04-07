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
Frontend will run on VITE_API_URL=http://localhost:4000

## Notes
- The frontend fetches /api/staff and /api/tasks from http://localhost:4000. Make sure backend is running.
- This is a starter scaffold. You can extend the API and UI (modals, Google Places integration, TUI Calendar) as needed.


## Old
- Frontend - https://vercel.com/divyanshs-projects-6f267141/field-service-app-fullcalendar/deployments?environment=production
- Backend - https://dashboard.render.com/web/srv-d5adq0qli9vc73b4ht4g

## New
- Banckend - https://backend-worker.sultania-divyansh.workers.dev/
- Frontend - https://field-service-app-fullcalendar-qurer8155.vercel.app/


## Front End Integration
```js
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})

const data = await res.json()

localStorage.setItem('token', data.token)


// Every API call

// headers: {
//   Authorization: `Bearer ${localStorage.getItem('token')}`
// }

```
