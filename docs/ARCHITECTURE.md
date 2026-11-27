# THREATNEX — System Architecture & Design Specification

**Product:** THREATNEX — AI-Powered Cyber Threat Intelligence and Investigation Platform  
**Architecture Pattern:** Modular Monolith with Distributed Caching & Microservice Containerization  
**Core Stack:** FastAPI, Python 3.12, PostgreSQL 16, Redis 7, React 18, TypeScript, Tailwind CSS, Docker  

---

## 1. High-Level Architecture

THREATNEX follows a **Modular Monolith architecture**, providing domain encapsulation and clear boundaries while retaining the operational simplicity and low deployment overhead of a single unified service.

```
                              +-------------------------+
                              |   Operator Browser UI   |
                              |  (React 18 + Vite SPA)  |
                              +-------------------------+
                                           |
                              HTTP / JSON + HttpOnly JWT
                                           |
                                           v
+---------------------------------------------------------------------------------+
|                       Docker Network: threatnex_network                         |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   |                  Nginx Reverse Proxy & Static Host                      |   |
|   |                       (threatnex_frontend :8080)                        |   |
|   +-------------------------------------------------------------------------+   |
|                                        |                                        |
|                          Proxy Pass /api/v1 to Backend                          |
|                                        v                                        |
|   +-------------------------------------------------------------------------+   |
|   |                        FastAPI Core Application                         |   |
|   |                        (threatnex_backend :8000)                        |   |
|   |                                                                         |   |
|   |   +------------------+  +-------------------+  +--------------------+   |   |
|   |   |   Auth & RBAC    |  |  IOC Validator    |  | Incident Cases     |   |   |
|   |   +------------------+  +-------------------+  +--------------------+   |   |
|   |   +------------------+  +-------------------+  +--------------------+   |   |
|   |   | Threat Feed Sync |  | AI Threat Analyst |  | Watchlist Engine   |   |   |
|   |   +------------------+  +-------------------+  +--------------------+   |   |
|   |   +------------------+  +-------------------+  +--------------------+   |   |
|   |   | Security Alerts  |  | Threat Reports    |  | Compliance Audit   |   |   |
|   |   +------------------+  +-------------------+  +--------------------+   |   |
|   +-------------------------------------------------------------------------+   |
|                     |                                     |                     |
|           Async SQLAlchemy 2                      aioredis / Sliding Window     |
|                     v                                     v                     |
|   +-----------------------------------+   +---------------------------------+   |
|   |       PostgreSQL 16 Engine        |   |         Redis 7 Cache           |   |
|   |      (threatnex_postgres :5432)   |   |     (threatnex_redis :6379)     |   |
|   +-----------------------------------+   +---------------------------------+   |
+---------------------------------------------------------------------------------+
```

---

## 2. Domain Modules Overview

### 2.1 Operations Domain
- **`app.modules.auth`**: Cryptographic identity using Argon2id password hashing, dual JWT issuance (`access_token` and `refresh_token`), session family rotation, and route-level RBAC (`Admin`, `Analyst`).
- **`app.modules.investigations`**: Incident case management lifecycle (`open`, `in_progress`, `resolved`, `closed`), severity triage (`critical`, `high`, `medium`, `low`), and indicator linkage.
- **`app.modules.dashboard`**: Operational SOC metrics, open case distribution, high-severity indicator counts, and real-time engine telemetry.

### 2.2 Intelligence Domain
- **`app.modules.indicators`**: Multi-provider enrichment engine integrating:
  - **VirusTotal**: Detection ratios, malicious engine flags, reputation scores.
  - **AbuseIPDB**: Abuse confidence score, total reports, country and ISP telemetry.
  - **AlienVault OTX**: Threat pulse associations, adversary tags, targeted malware.
  - **URLhaus**: Malware payload URLs, host blacklists, threat status.
- **`app.modules.threat_intel`**: Real-time threat feed ingestion service collecting, deduplicating, and persisting indicators from CISA KEV, URLhaus, AlienVault OTX, AbuseIPDB, and VirusTotal.
- **`app.modules.ai_analyst`**: Advanced cyber threat reasoning engine powered by Google Gemini. Synthesizes multi-engine findings into executive briefings, MITRE ATT&CK tactic/technique mappings, and containment playbooks.
- **`app.modules.watchlists`**: Targeted indicator tracking engine monitoring VIP infrastructure, threat actor campaigns, and critical endpoints with automatic match detection.

### 2.3 Management & Governance Domain
- **`app.modules.alerts`**: Correlation engine that generates alerts from incoming telemetry, enforces 24-hour noise deduplication windows, and enables one-click escalation into investigation cases.
- **`app.modules.reports`**: Structured reporting service generating incident post-mortems, technical IOC briefs, and executive summaries in Markdown and JSON formats.
- **`app.modules.audit`**: Immutable compliance audit trail logging all authentication events, administrative changes, and incident investigations for SOC 2 Type II compliance.
- **`app.modules.settings`**: System policy configuration managing scoring engine weights, alert threshold parameters, provider health status, and data retention policies.

---

## 3. Data Model & Database Architecture

The persistence layer uses PostgreSQL 16 with asynchronous SQLAlchemy 2 and Alembic schema migrations:

```
+---------------------------------------------------------------------------------+
|                                 ENTITY DIAGRAM                                  |
+---------------------------------------------------------------------------------+

       +---------------+ 1         * +----------------------+
       |     User      |------------<|      AuditLog        |
       +---------------+             +----------------------+
         |           |
         | *       * | 1
         v           v
  +------------+   +----------------------+ 1      * +----------------------+
  |    Role    |   |     Investigation    |---------<|  InvestigationIOC    |
  +------------+   +----------------------+          +----------------------+
                             ^ 1                                | *
                             |                                  v
                             | 1                     +----------------------+
                             |                       |      Indicator       |
                             |                       +----------------------+
                             |
                   +----------------------+ 1      * +----------------------+
                   |    SecurityAlert     |---------<| WatchlistIndicator   |
                   +----------------------+          +----------------------+
                                                        | *
                                                        v 1
                                                     +----------------------+
                                                     |      Watchlist       |
                                                     +----------------------+
```

### Table Definitions:
- `users`: Operator accounts, Argon2id password hashes, verification state.
- `roles` & `user_roles`: Role-based access control assignments (`Admin`, `Analyst`).
- `refresh_tokens`: Cryptographic refresh token families with revocation timestamps and JTI fingerprints.
- `indicators`: Normalized indicator catalog (value, type, calculated severity, confidence).
- `investigations`: Formal SOC incident cases with status, priority, and assignees.
- `investigation_indicators`: Association table linking observables to incident cases.
- `threat_feed_items`: Ingested threat feed entries from external providers.
- `ai_threat_analyses`: Cached Gemini AI threat assessments with structured JSON responses.
- `watchlists` & `watchlist_indicators`: Targeted monitoring collections and indicator items.
- `security_alerts`: Actionable security events with lifecycle status (`open`, `acknowledged`, `resolved`, `escalated`).
- `threat_reports`: Generated intelligence briefing documents in Markdown and JSON.
- `soc_settings`: Dynamic scoring weights, alert thresholds, and retention policies.
- `audit_logs`: Immutable compliance audit trail records.

---

## 4. Multi-Engine Threat Scoring Matrix

When an indicator is submitted for investigation, THREATNEX queries all applicable threat providers in parallel. The aggregate risk score is calculated as a normalized weighted composite:

$$\text{Risk Score} = \sum_{i=1}^{n} \left( W_i \times S_i \right)$$

Where $W_i$ is the engine weight configured in SOC Policies (default: VirusTotal 35%, AbuseIPDB 25%, AlienVault OTX 20%, URLhaus 20%), and $S_i$ is the provider normalized severity score on a 0–100 scale.

| Calculated Score | Severity Level | Automated SOC Action |
| :--- | :--- | :--- |
| **80 – 100** | **CRITICAL** | Automated high-priority alert generation; immediate case escalation flag |
| **60 – 79** | **HIGH** | Security alert queued in live triage table |
| **40 – 59** | **MEDIUM** | Telemetry recorded; indicator added to monitoring inventory |
| **1 – 39** | **LOW** | Informational event logged |
| **0** | **CLEAN / UNKNOWN** | Verified harmless or unclassified observable |

---

## 5. Security & Isolation Model

- **Zero Secret Exposure:** Frontend code contains zero API keys or backend credentials. All third-party queries originate strictly from the FastAPI container.
- **Fail-Closed Security:** In production mode, token revocation and rate-limiting require active Redis connectivity. If Redis fails, endpoints return HTTP 503 instead of falling back to unsafe local memory.
- **Tenant Isolation:** Non-admin analysts are restricted at the database SQL query level to cases they own, are assigned to, or are unassigned.
- **Container Hardening:** Containers run as non-root users (`threatnex` and `nginx`) with `read_only: true` root filesystems, dropped capabilities (`cap_drop: ALL`), and isolated internal networks.
