# Project Context
## Stack
MERN (MongoDB, Express, React, Node)
## Current Architecture
Multi-tenant SaaS using `Society` model with `societyId` scoping on `Resident` and `Ticket` models.
## External Services
- Cloudinary for image hosting
- Twilio Sandbox for WhatsApp notifications.
## Frontend Setup
Vite dev server proxying `/api` requests to `http://localhost:5000`.