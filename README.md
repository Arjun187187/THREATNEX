# ThreatNex
**AI-Powered Cyber Threat Intelligence and Investigation Platform**

ThreatNex is a production-grade, portfolio-ready SOC security operations and threat intelligence platform designed for cybersecurity analysts, incident response teams, and threat hunters.

---

## Architecture Overview

ThreatNex is engineered using a **modular monolith architecture** that maintains clean domain separation:

```
threatnex/
├── backend/
│   ├── app/
│   │   ├── core/           # Configuration, async DB session, Argon2id security, RBAC
│   │   ├── common/         # UUID and timestamp base mixins
│   │   └── modules/
│   │       ├── auth/           # User authentication, JWT tokens, RBAC roles (Admin, Analyst)
│   │       ├── indicators/     # IOC pattern validation engine (IPv4, IPv6, Domain, URL, Hashes, CVE)
│   │       ├── investigations/ # SOC case management & incident tracking
│   │       ├── audit/          # Compliance audit logging
│   │       └── dashboard/      # Real-time operational SOC telemetry & metrics
│   ├── alembic/            # Database schema migrations
│   └── tests/              # Pytest automated test suite
└── frontend/
    └── src/
        ├── api/            # Axios client with JWT refresh interceptors
        ├── context/        # Authentication & session state
        ├── components/     # SOC dark theme layout & reusable cards
        └── pages/          # Dashboard, IOC Search, Investigations, and Module placeholders
```

---

## Features (Phase 1 Implemented)

- **SOC Security Authentication**: User registration, login, and token refresh using **Argon2id** password hashing and **JWT** bearer tokens.
- **Role-Based Access Control (RBAC)**: Role assignment (`Admin`, `Analyst`) with route-level authorization guards.
- **Automated Audit Logging**: Secure recording of all sensitive actions (logins, logouts, case creation, updates).
- **IOC Validation Engine**: High-performance regex and semantic validator supporting:
  - IPv4 & IPv6 addresses
  - Domains & URLs
  - MD5, SHA1, SHA256 hashes
  - CVE vulnerability identifiers
- **Case & Incident Management**: Full investigation workflow tracking (Open, In Progress, Resolved, Closed) with priority assignment and IOC attachment.
- **Zero-Fabrication SOC Dashboard**: Telemetry and metrics computed strictly from real database records (no fake statistics or simulated events).
- **SOC Dark Interface**: React, TypeScript, and Tailwind CSS interface designed specifically for security operations centers.

---

## Local Setup & Quickstart

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 2. Run Backend Tests

```bash
# In backend/ directory:
pytest tests -v
```

### 3. Frontend Setup

```bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```

- Frontend URL: [http://localhost:5173](http://localhost:5173)

---

## Docker Deployment

To spin up the entire platform (PostgreSQL 16, Redis 7, Backend, and Frontend) via Docker:

```bash
docker compose up -d --build
```

---

## Security Architecture & Production Configuration

ThreatNex enforces multi-layered defense-in-depth across authentication, data persistence, and container infrastructure:

### 1. Authentication & Token Lifecycle
- **HttpOnly Secure Cookies**: Access and refresh tokens are delivered via `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies. Zero authentication tokens are stored in browser `localStorage` or `sessionStorage`.
- **Refresh Token Rotation & Reuse Detection**: Every refresh token has a unique UUID `jti` and is tracked in a cryptographic token `family_id` persisted in PostgreSQL. Replaying a consumed token immediately revokes the entire token family.
- **Distributed Token Revocation**: Logout and session termination blacklist token SHA-256 fingerprints in Redis with automated TTLs matching token expiration.
- **Fail-Closed Security in Production**: If Redis is offline during production (`ENVIRONMENT=production`), token revocation and rate-limiting operations fail closed (503 Service Unavailable) to prevent split-brain state across backend workers.

### 2. Rate Limiting & Anti-CSRF Protections
- **Sliding-Window Atomic Rate Limiting**: Managed via Redis sorted sets with unique member tracking to prevent race conditions and timestamp collisions.
- **Trusted Proxy Resolution**: IP resolution traverses forwarded proxy chains from right to left, stripping trusted hops to prevent `X-Forwarded-For` client spoofing.
- **Dual Anti-CSRF Validation**: State-changing requests (`POST`, `PATCH`, `PUT`, `DELETE`) authenticated via ambient cookies must carry the custom `X-Requested-With: XMLHttpRequest` header, and incoming `Origin` headers are strictly validated against allowed CORS origins.

### 3. Container & Infrastructure Hardening
- **Non-Root Execution**: Backend runs under UID 10001 (`threatnex`), Frontend runs as unprivileged user `nginx`.
- **Read-Only Root Filesystems**: Containers run with `read_only: true` with explicitly bounded `tmpfs` mounts for `/tmp`, `/var/run`, and `/var/cache/nginx`.
- **Linux Capability Drops**: All kernel capabilities are dropped (`cap_drop: [ALL]`), and privilege escalation is disabled (`no-new-privileges: true`).
- **Network Isolation**: PostgreSQL (5432) and Redis (6379) are isolated exclusively to the internal bridge network `threatnex_internal` without host port exposure.

### 4. Mandatory Production Environment Variables
| Variable | Production Requirement | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `production` | Activates strict production security validators and HSTS. |
| `SECRET_KEY` | At least 32 characters, high entropy | Cryptographic key. Placeholders and development strings are rejected on startup. |
| `COOKIE_SECURE` | `True` | Enforces HTTPS-only transmission for session cookies. |
| `TRUSTED_PROXIES` | E.g. `["10.0.0.1", "172.18.0.2"]` | Comma-separated or JSON list of internal reverse proxy IPs for safe client IP resolution. |
| `BACKEND_CORS_ORIGINS` | Production domains | Whitelist of trusted frontend origins allowed for credentialed requests. |

---

## Roadmap

- **Phase 2**: Threat Intelligence Feed Integrations (VirusTotal, AbuseIPDB, AlienVault OTX, URLhaus, CISA KEV).
- **Phase 3**: Configurable Multi-Factor Risk Scoring Engine.
- **Phase 4**: Provider-Independent AI Threat Analyst & MITRE ATT&CK Mapping.
