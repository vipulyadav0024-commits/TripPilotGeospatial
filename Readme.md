# 🧭 TripPilot — Geospatial Travel Planner

An AI-powered travel planning web app. Enter your trip details and it generates a day-by-day itinerary, budget, hotels and packing list. Every stop is placed on an interactive map, and the route for each day can be optimized.

## 🌐 Live Demo

| Part | Link |
|------|------|
| Frontend (Vercel) | https://trip-pilot-geospatial.vercel.app |
| Backend API (Render) | https://trippilot-backend-mtnj.onrender.com |
| Health check | https://trippilot-backend-mtnj.onrender.com/health |
| Source code | https://github.com/vipulyadav0024-commits/TripPilotGeospatial |

> The backend is on Render's free tier, so it sleeps when idle. The first request can take 30–60 seconds. Open the health link first to wake it up.
> Click **Create Account** to register before logging in.

---

## Features

- **Login / Register** with JWT authentication
- **AI trip generation** using Google Gemini: itinerary, meals, hotels, transport, budget, packing list and travel tips
- **Trip management:** create, view, update and delete trips, add custom activities, regenerate a single day with AI
- **Interactive map** (Leaflet + OpenStreetMap): every stop is shown as a pin, with a route drawn for each day
- **Route optimization:** finds the shortest visiting order for a day's activities
- **Nearby search:** find other stops in the trip within a chosen radius
- **USD / INR currency toggle:** the exchange rate is saved when the trip is created
- **Responsive design** for desktop and mobile

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| Map | Leaflet + OpenStreetMap |
| Backend | Node.js, Express |
| Database | MongoDB Atlas with Mongoose (2dsphere geospatial indexes) |
| AI | Google Gemini 2.5 Flash |
| Geocoding | OpenStreetMap Nominatim |
| Routing | OSRM (road distance and travel time) |
| Auth | JWT + bcryptjs |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

---

## How It Works

```
React app (Vercel)  →  Express API (Render)  →  MongoDB Atlas
                              │
                              ├→ Gemini AI (generates the itinerary)
                              ├→ Nominatim (finds coordinates for places)
                              └→ OSRM (road distance and time)
```

1. The user fills in the trip form and the frontend sends `POST /api/trips` with the JWT.
2. The backend verifies the token and asks Gemini for a JSON itinerary.
3. Each stop gets coordinates, and Nominatim is used when the AI's coordinates are missing or wrong.
4. The trip is saved in MongoDB with the user's id.
5. The frontend shows the itinerary and the map.

---

## Authentication

- **Register:** the password is hashed with bcrypt, the user is saved, and a JWT valid for 7 days is returned.
- **Login:** the password is checked with `bcrypt.compare`, and a JWT is returned and stored in `localStorage`.
- **Protected routes:** the auth middleware reads the `Authorization: Bearer <token>` header, verifies it and sets `req.user`.
- **Data isolation:** every trip stores a `userId`, and all queries filter by it, so a user can only see their own trips.

```js
const trips = await Trip.find({ userId: req.user.id });
```

---

## Project Structure

```
TripPilotGeospatial/
├── backend/
│   ├── config/db.js              # MongoDB connection
│   ├── controllers/              # authController, tripController
│   ├── middleware/auth.js        # JWT verification
│   ├── models/                   # User, Trip
│   ├── routes/                   # authRoutes, tripRoutes
│   ├── services/                 # geocoder, routing, geoService
│   ├── utils/geo.js              # distance and route optimization math
│   └── server.js
└── frontend/
    └── src/
        ├── components/           # Login, Register, Dashboard, TripMap, ...
        ├── App.jsx               # routes
        └── main.jsx
```

---

## Run Locally

**Requirements:** Node.js 18+, a MongoDB database (local or Atlas), and optionally a Gemini API key.

```bash
git clone https://github.com/vipulyadav0024-commits/TripPilotGeospatial.git
cd TripPilotGeospatial
```

**Backend**
```bash
cd backend
npm install
cp .env.example .env     # then fill in the values
npm run dev              # runs on http://localhost:5000
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev              # runs on http://localhost:5173
```

---

## Environment Variables

**Backend (`backend/.env`)**

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign tokens |
| `GEMINI_API_KEY` | No | Gemini key (sample data is used if missing) |
| `CORS_ORIGINS` | No | Allowed frontend URL(s), comma-separated |
| `PORT` | No | Server port (default 5000) |

**Frontend (`frontend/.env`)**

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend URL, e.g. `http://localhost:5000` (no trailing slash) |

---

## API Endpoints

**Auth**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login and get JWT |
| GET | `/api/auth/me` | Get current user |

**Trips** (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/trips` | Generate and save a trip |
| GET | `/api/trips` | List the user's trips |
| GET | `/api/trips/:id` | Get one trip |
| PUT | `/api/trips/:id` | Update a trip |
| DELETE | `/api/trips/:id` | Delete a trip |
| POST | `/api/trips/:id/regenerate-day` | Regenerate one day with AI |
| GET | `/api/trips/:id/geo` | Map data (pins and routes) |
| GET | `/api/trips/:id/nearby` | Stops within a radius |
| GET/POST | `/api/trips/:id/optimize-day/:n` | Preview / apply the optimized route for a day |

**Other:** `GET /health` shows the server status and the database connection.

---

## Deployment

1. **Database:** create a free MongoDB Atlas cluster, add a database user, and allow `0.0.0.0/0` under Network Access.
2. **Backend (Render):** set Root Directory to `backend`, Build Command to `npm install` and Start Command to `npm start`. Add the environment variables `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY` and `CORS_ORIGINS` (the Vercel URL).
3. **Frontend (Vercel):** set Root Directory to `frontend` and add `VITE_API_URL` (the Render URL). Redeploy after changing it, because Vite reads it at build time.

---


---

## Known Limitations

- The JWT is stored in `localStorage`, which is exposed to XSS. httpOnly cookies would be safer.
- Without a Gemini key, the app shows static sample data.
- Free-tier geocoding and routing (Nominatim, OSRM) can be slow, so the app falls back to approximate pins and straight-line distance.
- No email verification or password reset.
- Free-tier hosting means a slow first request after inactivity.

---

Built with React, Node.js, MongoDB and Google Gemini.
