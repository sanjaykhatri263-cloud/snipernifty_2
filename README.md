# Nifty Sniper v2 — Multi-user Live Signal Platform

```
nifty_signal_app/
├── backend/
│   ├── main.py              ← FastAPI: auth, data source, WebSocket, inference
│   ├── auth.py              ← JWT tokens, user DB (users.json), subscriber CRUD
│   ├── data_sources.py      ← yfinance + ICICI Breeze abstraction layer
│   ├── requirements.txt
│   ├── .env.example         ← Copy to .env and fill in secrets
│   └── models/              ← Place your .pkl and .pth files here
└── frontend/
    ├── src/App.jsx          ← Login + Admin console + Subscriber dashboard
    ├── .env.example         ← Copy to .env, set API/WS URLs
    └── ...
```

---

## Quick start

### Step 1 — model files
```bash
mkdir -p backend/models
cp nifty_scaler_dual_V2.pkl long_brain_10bar_V2.pth short_brain_10bar_V2.pth backend/models/
```

### Step 2 — backend
```bash
cd backend
cp .env.example .env          # Edit ADMIN_PASSWORD and JWT_SECRET!
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Step 3 — frontend
```bash
cd frontend
cp .env.example .env          # VITE_API_URL and VITE_WS_URL default to localhost
npm install && npm run dev
# → http://localhost:5173
```

---

## Roles

| Role | Can do |
|---|---|
| **admin** | Login → Admin console: add/suspend/delete subscribers, switch data source, set thresholds |
| **subscriber** | Login → Signal dashboard: view live signals, see current threshold (read-only) |

### First login
- Username: value of `ADMIN_USERNAME` in `.env` (default: `admin`)
- Password: value of `ADMIN_PASSWORD` in `.env` (default: `changeme123`)

---

## Subscriber management (Admin console)

| Action | How |
|---|---|
| Add subscriber | Admin console → Subscribers tab → fill form → Add |
| Suspend | Click "Suspend" — user gets 401 on next WS connect |
| Re-activate | Click "Activate" |
| Delete | Click ✕ |
| Reset password | `POST /admin/subscribers/{username}/reset-password` |

Subscribers **cannot** self-register. Only admin creates accounts.

---

## Data source switching (live, no restart needed)

### yfinance (default)
- No credentials needed
- ~15 min delay
- Admin console → Data Source → "Switch to yfinance"

### ICICI Direct Breeze (real-time)
1. Register at https://api.icicidirect.com → create app → get `api_key` + `api_secret`
2. **Each morning**: visit login URL to get the daily `session_token`:
   ```
   https://api.icicidirect.com/apiuser/login?api_key=YOUR_KEY
   ```
   After login it redirects to your app URL with `?apisession=TOKEN`
3. Admin console → Data Source → fill Breeze fields → Connect
4. Backend switches immediately, broadcasts `data_source_changed` to all clients
5. Install extra package: `pip install breeze-connect`

---

## WebSocket protocol

Connection: `ws://host/ws?token=<JWT>`
- Unauthenticated → closed with code 4001
- Suspended user → closed with code 4001

Server → Client messages:
```json
{"type": "signal",              "data": {...}}   // new inference result
{"type": "history",             "data": [...]}   // on connect: last 200 signals
{"type": "data_source",         "data": {...}}   // on connect: current source status
{"type": "data_source_changed", "data": {...}}   // when admin switches source
```

Client → Server (admin only):
```json
{"type": "set_threshold", "long": 0.80, "short": 0.80}
```

---

## Cloud deploy (free)

**Railway** (backend) + **Netlify** (frontend):
```
Railway:
  Build: pip install -r requirements.txt
  Start: uvicorn main:app --host 0.0.0.0 --port $PORT
  Env:   ADMIN_PASSWORD, JWT_SECRET, ADMIN_USERNAME
  Volume: /app/models  (upload .pkl and .pth files)

Netlify:
  Build: npm run build (from frontend/)
  Env:   VITE_API_URL=https://your-app.railway.app
         VITE_WS_URL=wss://your-app.railway.app/ws
```
