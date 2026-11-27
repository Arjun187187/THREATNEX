# THREATNEX — REST API Specification & Reference

**Base URL:** `http://localhost:8001/api/v1` (via Docker) or `http://127.0.0.1:8000/api/v1` (local)  
**OpenAPI Documentation:** Interactive Swagger UI at `/docs` | ReDoc at `/redoc`  
**Authentication:** Dual support: `Authorization: Bearer <token>` or HttpOnly Secure Cookies (`threatnex_access_token`)  

---

## 1. Authentication & Operator Identity (`/api/v1/auth`)

### `POST /auth/register`
Enroll a new SOC operator account. The first registered non-test operator receives both `Admin` and `Analyst` roles.
- **Request Body:**
  ```json
  {
    "username": "soc_analyst",
    "email": "analyst@threatnex.local",
    "full_name": "SOC Lead Analyst",
    "password": "StrongPassword123!"
  }
  ```
- **Responses:** `201 Created` with User object | `400 Bad Request` if username/email already registered | `422 Unprocessable Entity`

### `POST /auth/login`
Authenticate using username or email and passphrase. Sets HttpOnly cookies and returns token payload.
- **Request Body:**
  ```json
  {
    "username_or_email": "soc_analyst",
    "password": "StrongPassword123!"
  }
  ```
- **Responses:** `200 OK`
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "refresh_token": "eyJhbGciOiJIUzI1Ni...",
    "token_type": "bearer",
    "expires_in": 1800,
    "user": { "id": "uuid", "username": "soc_analyst", "roles": ["Admin", "Analyst"] }
  }
  ```

### `POST /auth/refresh`
Refreshes the current operator access token and rotates the refresh token family.
- **Header:** `X-Requested-With: XMLHttpRequest` (when using cookies)
- **Responses:** `200 OK` with newly issued access and refresh tokens | `401 Unauthorized` if token revoked or replayed.

### `POST /auth/logout`
Revokes current operator tokens across Redis and clears authentication cookies.
- **Responses:** `200 OK`

### `GET /auth/me`
Retrieve the currently authenticated operator profile and assigned roles.
- **Responses:** `200 OK` with user details.

---

## 2. IOC Investigation & Enrichment (`/api/v1/indicators`)

### `POST /indicators/validate`
Validates and detects the format of a submitted observable string.
- **Request Body:** `{ "value": "1.1.1.1" }`
- **Responses:** `200 OK`
  ```json
  {
    "value": "1.1.1.1",
    "is_valid": true,
    "ioc_type": "ipv4",
    "message": "Valid IPv4 address"
  }
  ```

### `POST /indicators/investigate`
Executes real-time multi-provider threat intelligence enrichment across VirusTotal, AbuseIPDB, AlienVault OTX, and URLhaus.
- **Request Body:**
  ```json
  {
    "value": "1.1.1.1",
    "save_to_inventory": true,
    "expected_type": "ipv4"
  }
  ```
- **Responses:** `200 OK`
  ```json
  {
    "value": "1.1.1.1",
    "normalized_value": "1.1.1.1",
    "ioc_type": "ipv4",
    "is_valid": true,
    "queried_at": "2026-11-27T12:00:00Z",
    "overall_verdict": "suspicious",
    "calculated_severity": "medium",
    "overall_confidence": 75.0,
    "providers": {
      "virustotal": { "status": "success", "malicious": 4, "suspicious": 1, "verdict": "suspicious" },
      "abuseipdb": { "status": "success", "reputation_score": 0.0, "verdict": "clean" },
      "alienvault_otx": { "status": "success", "reputation_score": 25.0, "verdict": "suspicious" }
    }
  }
  ```

### `GET /indicators/investigations/history`
Retrieve paginated historical indicator investigation records.
- **Query Parameters:** `limit` (default: 20), `offset` (default: 0)
- **Responses:** `200 OK` with list of investigation summaries.

---

## 3. Threat Intelligence Feed (`/api/v1/threat-intel`)

### `GET /threat-intel/feed`
Retrieve paginated real-time threat intelligence indicators collected from external feeds.
- **Query Parameters:** `q`, `ioc_type`, `provider`, `severity`, `threat_category`, `min_confidence`, `page`, `page_size`.
- **Responses:** `200 OK` with `{ "items": [...], "total": 336, "page": 1, "page_size": 25, "total_pages": 14 }`.

### `POST /threat-intel/sync`
Triggers manual on-demand synchronization across external threat intelligence providers (AlienVault OTX, URLhaus, CISA KEV, AbuseIPDB, VirusTotal).
- **Responses:** `200 OK`
  ```json
  {
    "status": "success",
    "message": "Threat intelligence sync completed: 178 new, 0 updated across 5 providers.",
    "total_ingested": 178,
    "total_updated": 0,
    "results": [...]
  }
  ```

### `GET /threat-intel/stats`
Retrieve aggregated feed statistics, including breakdowns by provider, severity, and indicator type.
- **Responses:** `200 OK`

### `GET /threat-intel/providers/status`
Retrieve connectivity status, last sync timestamp, and rate-limit metadata for all feed providers.
- **Responses:** `200 OK`

---

## 4. AI Cyber Threat Analyst (`/api/v1/ai-analyst`)

### `POST /ai-analyst/analyze`
Submits an observable or existing investigation to Google Gemini for structured cyber threat reasoning.
- **Request Body:**
  ```json
  {
    "indicator_value": "1.1.1.1",
    "ioc_type": "ipv4"
  }
  ```
- **Responses:** `200 OK`
  ```json
  {
    "id": "uuid",
    "indicator_value": "1.1.1.1",
    "ioc_type": "ipv4",
    "model_name": "gemini-flash-lite-latest",
    "risk_level": "CLEAN",
    "threat_classification": "Legitimate Public DNS Resolver",
    "confidence_score": 95.0,
    "executive_summary": "...",
    "mitre_techniques": [...],
    "recommended_containment_actions": [...]
  }
  ```

### `GET /ai-analyst/history`
Retrieve chronological history of completed AI threat evaluations.
- **Responses:** `200 OK` with list of previous analysis records.

---

## 5. Threat Watchlists (`/api/v1/watchlists`)

### `GET /watchlists/`
Retrieve all active threat watchlists and current match counts.
- **Responses:** `200 OK`

### `POST /watchlists/`
Create a new targeted threat watchlist collection.
- **Request Body:**
  ```json
  {
    "name": "Ransomware Ingress Infrastructure",
    "category": "Ransomware Campaign",
    "severity": "critical",
    "description": "Continuous monitoring of known C2 infrastructure"
  }
  ```
- **Responses:** `201 Created`

### `POST /watchlists/{id}/indicators`
Add an observable to an active watchlist.
- **Request Body:**
  ```json
  {
    "indicator_value": "198.51.100.24",
    "ioc_type": "ipv4",
    "severity": "critical",
    "confidence": 90.0,
    "notes": "Observed in outbound telemetry"
  }
  ```
- **Responses:** `201 Created`

### `DELETE /watchlists/{id}/indicators/{indicator_id}`
Retire and remove an indicator from a watchlist.
- **Responses:** `204 No Content`

---

## 6. Security Alerts & Triage (`/api/v1/alerts`)

### `GET /alerts/`
Query live security alerts filtered by status, severity, and search term.
- **Query Parameters:** `status` (`open`, `acknowledged`, `resolved`, `escalated`, `all`), `severity`, `search`, `page`, `page_size`.
- **Responses:** `200 OK`

### `POST /alerts/`
Ingest or create a new security alert with automated 24-hour deduplication.
- **Request Body:**
  ```json
  {
    "title": "Malicious C2 Communication Detected",
    "indicator_value": "198.51.100.24",
    "ioc_type": "ipv4",
    "severity": "high",
    "source_rule": "Threat Intelligence Correlation Rule",
    "confidence": 85.0
  }
  ```
- **Responses:** `201 Created`

### `POST /alerts/{id}/acknowledge`
Transitions alert status from `open` to `acknowledged`.
- **Responses:** `200 OK`

### `POST /alerts/{id}/resolve`
Marks alert as resolved with mandatory operator remediation notes.
- **Request Body:** `{ "resolution_notes": "Confirmed benign scanner. IP whitelisted." }`
- **Responses:** `200 OK`

### `POST /alerts/{id}/escalate`
Promotes an alert directly into a new formal Incident Investigation Case.
- **Request Body:** `{ "case_title": "Escalated Incident: 198.51.100.24" }`
- **Responses:** `200 OK` with `case_id` reference.

---

## 7. Threat Reports (`/api/v1/reports`)

### `GET /reports/`
List generated threat intelligence reports and incident post-mortems.
- **Responses:** `200 OK`

### `POST /reports/generate`
Synthesize structured Markdown and JSON reports from incident cases, investigations, or observables.
- **Request Body:**
  ```json
  {
    "title": "Incident Post-Mortem Briefing",
    "report_type": "incident_case",
    "indicator_value": "1.1.1.1",
    "include_ai_synthesis": true
  }
  ```
- **Responses:** `201 Created` with full Markdown text and executive summary.

### `GET /reports/{id}`
Retrieve full markdown and JSON report contents by ID.
- **Responses:** `200 OK`

---

## 8. Compliance Audit Trail (`/api/v1/audit`)

### `GET /audit/logs`
Query immutable system compliance audit logs under RBAC authorization.
- **Query Parameters:** `action` (e.g. `LOGIN`, `CREATE_ALERT`, `RESOLVE_ALERT`), `resource_type`, `search`, `page`, `page_size`.
- **Responses:** `200 OK` with actor attribution, client IP, action timestamp, and resource references.

---

## 9. SOC Policies & Settings (`/api/v1/settings`)

### `GET /settings/`
Retrieve current multi-engine scoring weights, alert threshold parameters, provider connectivity status, and retention policies.
- **Responses:** `200 OK`

### `PUT /settings/scoring-weights`
Update engine weighting matrix (requires `Admin` role).
- **Request Body:**
  ```json
  {
    "virustotal_weight": 35.0,
    "abuseipdb_weight": 25.0,
    "alienvault_weight": 20.0,
    "urlhaus_weight": 20.0
  }
  ```
- **Responses:** `200 OK`

### `PUT /settings/alert-thresholds`
Update automated alert confidence thresholds and escalation triggers (requires `Admin` role).
- **Request Body:**
  ```json
  {
    "min_confidence_to_alert": 75.0,
    "auto_escalate_critical": true,
    "deduplication_window_hours": 24,
    "require_analyst_resolution_notes": true
  }
  ```
- **Responses:** `200 OK`

---

## 10. System Health (`/health`)

### `GET /health`
Liveness and readiness health probe.
- **Responses:** `200 OK`
  ```json
  {
    "status": "healthy",
    "service": "ThreatNex",
    "environment": "development",
    "version": "1.0.0"
  }
  ```
