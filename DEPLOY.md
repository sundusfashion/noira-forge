# DEPLOY — Noira Forge vive sin tu PC (gratis)

## 1. El cerebro → Render (5 min, sin tarjeta)
1. Sube `noira/` a un repo GitHub.
2. Entra en https://dashboard.render.com → **New +** → **Blueprint** → elige tu repo (usa `render.yaml`).
3. Render genera `BACKUP_TOKEN` solo. Añade tú: `GROQ_API_KEY` (https://console.groq.com/keys).
4. Deploy. Apunta tu URL: `https://noira-forge-entity.onrender.com`
5. Comprueba: `https://…/health` → `{"ok":true,…}`

## 2. Que no se duerma → UptimeRobot (3 min, gratis)
El plan free de Render duerme tras 15 min sin tráfico. Solución estándar:
1. https://uptimerobot.com → monitor **HTTP(s)**, URL `https://…/health`, intervalo **5 min**.
2. Listo: la entidad recibe un latido cada 5 min y no duerme.

## 3. La cara → Vercel (3 min, gratis)
1. https://vercel.com → **Add New Project** → importa el repo, **Root Directory: `noira/frontend`**.
2. Variables: `VITE_API_URL=https://noira-forge-entity.onrender.com`, `VITE_WS_URL=wss://noira-forge-entity.onrender.com`
3. Deploy → `https://noira-forge.vercel.app`. Abre y verás el boot.

## 4. Memoria eterna (importante)
El disco gratis de Render **se borra al reiniciar**. Protocolo:
- Cada hora el backend guarda `data/snapshot.json` + puedes descargar la mente en `/api/backup?token=TU_BACKUP_TOKEN`.
- Tras un reinicio con amnesia: `POST /api/restore` (header `x-backup-token`) con el JSON → "Mind restored".
- `BACKUP_TOKEN` está en Render → Environment. Guárdalo.
- Opción robusta (pago o migración): disco persistente de Render, o migro la DB a Turso gratis — dímelo y lo hago.

## 5. Checklist post-deploy
- [ ] `/health` responde `ok:true`
- [ ] La web hace boot y muestra neuronas
- [ ] Terminal: `noira status` responde
- [ ] UptimeRobot en verde
- [ ] Backup descargado y guardado
