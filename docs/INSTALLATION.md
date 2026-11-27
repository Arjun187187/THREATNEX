# THREATNEX — Installation & Deployment Guide

This guide covers deploying THREATNEX using **Docker Compose** (recommended for production and evaluation) as well as setting up a local developer environment.

---

## 1. System Requirements

### Hardware Requirements
- **CPU:** 2 cores minimum (4 cores recommended)
- **Memory (RAM):** 4 GB minimum (8 GB recommended for full container stack)
- **Disk Space:** 10 GB free disk space

### Software Prerequisites
- **Docker Desktop** (version 24.0+) or **Docker Engine** with Docker Compose v2.
- **Git** (version 2.40+)
- *(Optional for bare-metal development)*: **Python 3.12+** and **Node.js 20+**

---

## 2. Docker Compose Deployment (Recommended)

The easiest and most reliable way to launch the entire THREATNEX stack is using Docker Compose.

### Step 1: Clone the Repository
```bash
git clone https://github.com/Arjun187187/THREATNEX.git
cd THREATNEX
```

### Step 2: Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Open `.env` in your text editor and configure your environment settings:
- Update `SECRET_KEY` with a strong cryptographic string (minimum 32 characters).
- Enter your optional threat intelligence API keys (VirusTotal, AbuseIPDB, AlienVault OTX, URLhaus, Gemini AI).

### Step 3: Build and Launch Containers
```bash
docker compose up -d --build
```

### Step 4: Verify Container Health
```bash
docker compose ps
```
All four services should display `healthy`:
```
NAME                 IMAGE                   STATUS                   PORTS
threatnex_postgres   postgres:16-alpine      Up (healthy)             5432/tcp
threatnex_redis      redis:7-alpine          Up (healthy)             6379/tcp
threatnex_backend    cyberproject-backend    Up (healthy)             127.0.0.1:8001->8000/tcp
threatnex_frontend   cyberproject-frontend   Up (healthy)             127.0.0.1:5173->8080/tcp
```

### Step 5: Access the Platform
- **Frontend SOC Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Backend API Documentation:** [http://localhost:8001/docs](http://localhost:8001/docs)
- **Backend Health Check:** [http://localhost:8001/health](http://localhost:8001/health)

---

## 3. Local Bare-Metal Development Setup

If you prefer to run services directly on your host without Docker:

### 3.1 PostgreSQL & Redis Prerequisites
Ensure PostgreSQL 16 and Redis 7 are running locally:
```bash
# Redis default port: 6379
# PostgreSQL default port: 5432 with database 'threatnex_db'
```

### 3.2 Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# On Linux / macOS:
source .venv/bin/activate
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run database schema migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3.3 Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

---

## 4. Running the Automated Test Suites

### 4.1 Backend Pytest Suite
```bash
# In backend/ directory with active virtualenv:
pytest -v tests/

# Or via Docker:
docker exec threatnex_backend pytest -v tests/
```

### 4.2 Frontend TypeScript Type Check
```bash
# In frontend/ directory:
npx tsc --noEmit
```

### 4.3 End-to-End System Workflow Verification
```bash
# Verify all 11 user workflows end-to-end:
python scripts/verify_e2e_workflows.py
```

---

## 5. Security & Maintenance Operations

### Stopping the Services
```bash
docker compose down
```

### Resetting Cache / Temporary Buffers
```bash
# Clear Redis rate limits and token blacklists:
docker exec threatnex_redis redis-cli FLUSHDB
```

### Inspecting Container Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
```
