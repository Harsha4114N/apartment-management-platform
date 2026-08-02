// Dynamically switches between production and local API based on environment.
// In production (Vercel/Netlify), set VITE_API_BASE (or VITE_API_URL) to your
// deployed backend URL. If the env vars are missing during a PRODUCTION build,
// fall back to the live Render backend so API calls keep working.
//
// NOTE: Every API call site appends "/api/<route>" to API_BASE (e.g.
// `${API_BASE}/api/auth/login`), so the exported value must resolve to the
// backend host. The trailing "/api" in the fallback below is normalized away
// to prevent double "/api/api" paths.
const PROD_API_FALLBACK = 'https://apartment-management-platform.onrender.com/api';
const DEV_API_FALLBACK = 'http://localhost:5000';

const resolvedBase =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? PROD_API_FALLBACK : DEV_API_FALLBACK);

// Strip a trailing "/api" so call sites that append "/api" never double it.
const API_BASE = resolvedBase.replace(/\/api\/?$/, '');

export default API_BASE;
