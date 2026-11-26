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

## Roadmap

- **Phase 2**: Threat Intelligence Feed Integrations (VirusTotal, AbuseIPDB, AlienVault OTX, URLhaus, CISA KEV).
- **Phase 3**: Configurable Multi-Factor Risk Scoring Engine.
- **Phase 4**: Provider-Independent AI Threat Analyst & MITRE ATT&CK Mapping.
