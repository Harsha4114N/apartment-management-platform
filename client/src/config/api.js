// Dynamically switches between production and local API based on environment.
// In production (Vercel/Netlify), set VITE_API_BASE to your deployed backend URL.
// In local development, defaults to http://localhost:5000.
const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default API_BASE;
