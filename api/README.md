# PlantCare AI deployment

## Frontend configuration

Set `VITE_API_URL` to the backend base URL, without an endpoint suffix:

```text
VITE_API_URL=https://dl-projet.onrender.com
```

For local development, `frontend/.env` can use the same value, or omit it to
use `http://127.0.0.1:8000`. Vite embeds this setting at build time. If the
frontend is hosted, add `VITE_API_URL` in its hosting dashboard and redeploy
the frontend after changing it. For this Vercel deployment, set
`VITE_API_URL=https://dl-projet.onrender.com` in the Vercel project settings
under **Settings → Environment Variables**, for the environments being
deployed, then redeploy.

## Backend configuration

The API allows the Vite development origins and
`https://dl-projet.vercel.app`. If the frontend uses another domain, set
`CORS_ORIGINS` in the backend hosting dashboard to its exact origin (scheme
and host, without a path or trailing slash), for example:

```text
CORS_ORIGINS=https://your-frontend-host.example
```

For multiple additional frontend origins, separate them with commas.
Wildcard origins are not supported. Redeploy the backend after changing this
setting.

The Render start command can be:

```text
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

The Python entry point also binds to `0.0.0.0` and reads the hosting platform's
`PORT`, defaulting to port `8000` for local runs.
