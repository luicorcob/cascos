# Project structure

LocalLift Studio keeps the simple static entry point at the repository root and moves implementation details into focused folders.

```text
.
├── index.html
├── .env.example
├── Dockerfile
├── render.yaml
├── src/
│   ├── app.js
│   └── styles.css
├── pages/
│   ├── investor.html
│   ├── onboarding.html
│   ├── google-ops.html
│   └── store-admin.html
├── server/
│   ├── server.mjs
│   └── api/
├── examples/
│   ├── chatbot-api.example.mjs
│   ├── commerce-api.example.mjs
│   └── google-integration.example.mjs
├── assets/
│   └── vendor/
├── data/
└── docs/
```

## Conventions

- Put editor UI code in `src/`.
- Put business portal modules in `src/business/` and their dedicated CSS in `src/styles/`.
- Put browser-only auxiliary pages in `pages/`.
- Put runnable Node services in `server/` or `examples/`.
- Put playbooks, sales material and checklists in `docs/`.
- Keep `index.html` at the root so the studio remains easy to open directly.

## Current portal files

- `pages/business-dashboard.html`: first owner-facing operations portal.
- `pages/monthly-report.html`: printable monthly report for client delivery.
- `src/business/dashboard.js`: API loading, tab rendering and operational metrics.
- `src/business/monthly-report.js`: printable report loader and renderer.
- `src/styles/business.css`: responsive dashboard styling.
- `src/styles/report.css`: printable monthly report styling.
- `server/api/contact-api.mjs`: CRM endpoints for public leads, contacts and activities.
- `server/api/booking-api.mjs`: booking endpoints for services, public bookings, weekly availability, manual blocks, reminders and admin agenda.
- `server/api/event-api.mjs`: public conversion event capture and business event listing.
- `server/api/health-api.mjs`: deployment healthcheck with API, database and count status.
- `server/api/report-api.mjs`: monthly operational report endpoint with metrics and recommendations.
- `server/lib/admin-auth.mjs`: optional admin API token guard for production deployments.
- `server/lib/cors.mjs`: shared CORS headers driven by `CORS_ORIGIN` / `LOCALLIFT_CORS_ORIGIN`.
- `server/scripts/validate-deploy-env.mjs`: production startup guard for token, CORS and persistent DB env.
- `.env.example`: environment variable template for local development and production hosting.
- `Dockerfile`: container deployment entrypoint for production hosting.
- `render.yaml`: Render Blueprint for the first hosted backend with healthcheck and persistent disk.
- `docs/DEPLOYMENT.md`: first deployment guide for frontend, backend, environment variables and healthcheck.
- `docs/PILOT_LAUNCH.md`: operational runbook for the first online pilot.
