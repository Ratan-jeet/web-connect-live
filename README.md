# Web Connect (Render)

Small-group chat and voice calls in the browser. This copy is set up for **Render** deployment.

Original local project: `web-connect` (separate folder/repo — leave that one alone).

## Run locally

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- Signaling server: http://localhost:3001

## Deploy on Render

1. Push this folder to a **new** GitHub repo (not the original `web-connect` repo).
2. In [Render](https://render.com) → **New** → **Web Service** → connect that repo.
3. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** Free
   - **Health check path:** `/health`
4. Deploy. Open the Render URL — UI + Socket.io run on the same service.

Or use the included `render.yaml` via **New** → **Blueprint**.

### Free tier note

Free web services sleep after ~15 minutes idle and have ~750 instance hours/month.

## Stack

- Vite + React + TypeScript
- Express + Socket.io (rooms, chat, WebRTC signaling)
- WebRTC mesh audio (peer-to-peer)
