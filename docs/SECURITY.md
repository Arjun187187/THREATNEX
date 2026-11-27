# THREATNEX — Enterprise Security Architecture & Verification Specification

**Product:** THREATNEX — AI-Powered Cyber Threat Intelligence and Investigation Platform  
**Classification:** Enterprise Security Architecture Specification  
**Status:** **ACTIVE / VERIFIED**  
**Audit Standard:** Defense-in-Depth, OWASP Top 10, SOC 2 Type II Compliance Framework  

---

## 1. Executive Summary

THREATNEX implements a zero-trust, defense-in-depth security architecture designed to safeguard enterprise security operations center (SOC) telemetry, threat intelligence feeds, incident investigation records, and administrative access. 

The security architecture enforces strict separation of concerns, cryptographic session integrity, distributed state management, and hardened container isolation:

- **Isolated Docker Runtime:** Complete microservice fleet (`threatnex_postgres`, `threatnex_redis`, `threatnex_backend`, `threatnex_frontend`) operates under hardened, read-only root filesystems and non-root service accounts.
- **Backend Test Suite:** 19/19 pytest tests passing (100% pass rate) validating authentication, token rotation, CSRF defense, IDOR isolation, rate limiting, and fail-closed policies.
- **Frontend Security Posture:** Single-Page Application (SPA) compiled under TypeScript strict mode (`tsc && vite build`) with zero exposed secrets and isolated client proxies.
- **Static Application Security Testing (SAST):** Bandit security scanner reports 0 security issues across backend source modules.
- **Zero Secret Exposure Architecture:** All threat provider API keys (VirusTotal, AbuseIPDB, AlienVault OTX, URLhaus, Google Gemini) are held strictly in backend container environments and never transmitted to client browsers.

---

## 2. Authentication & Cryptographic Identity

### 2.1 Password Hashing (Argon2id)
All user credentials are encrypted using **Argon2id**, the state-of-the-art memory-hard hashing algorithm resistant to GPU and ASIC brute-force attacks:
- **Time Cost:** 3 iterations
- **Memory Cost:** 64 MB (`65536 KB`)
- **Parallelism:** 4 threads
- **Hash Length:** 32 bytes
- **Salt Length:** 16 bytes

### 2.2 Dual-Token JWT Lifecycle & Rotation
Authentication utilizes dual JSON Web Tokens (JWT) adhering to RFC 7519:
1. **Access Token:**
   - Short-lived lifespan: **30 minutes**.
   - Cryptographically signed with **HS256** using an enforced minimum 32-character secret key.
   - Standard claims strictly validated: `iss` (issuer), `aud` (audience), `sub` (subject), `roles`, `type`, `jti` (unique identifier), `iat` (issued at), and `exp` (expiration).
   - Delivered via **Secure, HttpOnly, SameSite=Lax** cookies as well as Bearer authorization headers for API interoperability.
2. **Refresh Token & Replay Detection:**
   - Lifespan: **7 days**.
   - Persisted in PostgreSQL with cryptographic SHA-256 fingerprinting.
   - Enforces **Refresh Token Family Rotation**: Upon refreshing an access token, the current refresh token is revoked and replaced with a newly minted child token.
   - **Replay Attack Defense:** If a revoked refresh token is presented, the system detects token theft, immediately invalidates the entire token family, revokes all active operator sessions, and logs an alert in the audit trail.

---

## 3. Threat Model & Architectural Defenses

| Threat Vector | Severity | Vulnerability Mechanism | THREATNEX Architectural Mitigation | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **Token Theft / XSS Harvesting** | Critical | Browser `localStorage` token storage | Tokens stored in **HttpOnly, Secure, SameSite=Lax** cookies inaccessible to client-side JavaScript. | Automated HTTP client cookie header inspection |
| **Cross-Site Request Forgery (CSRF)** | High | Ambient cookie transmission on state-changing requests | Enforces custom header `X-Requested-With` and validates request `Origin` against authorized `BACKEND_CORS_ORIGINS`. | Mutating request without custom header rejected (HTTP 403) |
| **Brute-Force & Denial of Service** | High | Unrestricted endpoint probing | Distributed Redis sliding-window rate limiting keyed by client IP and action. | 429 Too Many Requests with `Retry-After` header |
| **Reverse Proxy IP Spoofing** | High | Leftmost forged IP in `X-Forwarded-For` | Right-to-left traversal of `X-Forwarded-For` filtering untrusted client IPs through trusted proxy subnet ranges. | Automated reverse proxy spoofing test suite |
| **Distributed State Split-Brain** | High | Process-local in-memory blacklists in multi-worker deployments | Shared **Redis 7** connection pool for global token revocation and rate-limiting. | Multi-worker concurrent revocation test |
| **Fail-Open Outage Vulnerability** | High | Silent bypass of security controls when cache is offline | **Fail-Closed Policy:** In production, Redis outages immediately raise HTTP 503 rather than permitting unmetered access. | `test_production_redis_fail_closed` |
| **Insecure Direct Object Reference (IDOR)** | High | Enumeration of private investigation cases by unauthorized analysts | SQL-level tenancy filter: Analysts can only view cases they own, are assigned to, or that are unassigned. | Multi-user cross-tenant IDOR test |
| **Container Escape / Privilege Escalation** | High | Root container processes or writable filesystems | Non-root users (`threatnex`, `nginx`), `read_only: true` rootfs, and dropped Linux capabilities (`cap_drop: ALL`). | Docker Compose runtime inspection |

---

## 4. Cross-Site Request Forgery (CSRF) & Origin Defense

Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) authenticate via cookies and enforce two independent cryptographic boundaries:

1. **Origin Header Validation:**
   ```
   Allowed Origins: http://localhost:5173, http://127.0.0.1:5173
   ```
   Requests originating from external domains or null origins are rejected with `HTTP 403 Forbidden`.
2. **Anti-CSRF Header Requirement:**
   Browsers cannot attach custom headers across cross-origin simple requests without triggering a preflight `OPTIONS` check. The server enforces:
   ```http
   X-Requested-With: XMLHttpRequest
   ```
   Any cookie-authenticated mutation lacking this header is rejected immediately.

---

## 5. Distributed Rate Limiting & Fail-Closed Policy

Rate limiting uses a distributed Redis sliding-window sorted set algorithm:
- Key format: `ratelimit:{key_prefix}:{client_ip}`
- Window: Time-bounded sliding calculation using microsecond timestamps.
- **Fail-Closed Enforcement:** When `ENVIRONMENT=production`, if the Redis cluster becomes unavailable, authentication and rate-limited endpoints refuse requests with `503 Service Unavailable` rather than failing open.

```
+-------------------------------------------------------------------------+
|                  Client Request (Login / Refresh / IOC)                 |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                Reverse Proxy IP Extraction (Right-to-Left)               |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                Redis Sliding Window Rate Limiter                        |
|   (Score: Timestamp, Member: UUID, Window: 60s, Limit: Endpoint Matrix) |
+-------------------------------------------------------------------------+
            |                                           |
    [Within Limits]                             [Threshold Exceeded]
            |                                           |
            v                                           v
+-----------------------+                   +-----------------------+
|  Pass to Route Logic  |                   | HTTP 429 Rate Limited |
+-----------------------+                   | Retry-After: <secs>   |
                                            +-----------------------+
```

---

## 6. Container Hardening & Infrastructure Microsegmentation

All services run inside containerized environments with strict OS-level containment:

```yaml
# Hardening parameters applied to services in docker-compose.yml
security_opt:
  - no-new-privileges:true
read_only: true
cap_drop:
  - ALL
tmpfs:
  - /tmp:rw,noexec,nosuid,size=64m
```

- **Network Isolation:** PostgreSQL (`threatnex_postgres`) and Redis (`threatnex_redis`) bind only to internal Docker network interfaces. They do not expose ports on the host.
- **Process Isolation:** The backend runs under non-root user `threatnex` (UID `10001`). The frontend Nginx proxy runs under non-root user `nginx` (UID `101`) bound to unprivileged port `8080`.
- **Filesystem Immutability:** Application root filesystems are mounted read-only (`read_only: true`). Ephemeral write operations are restricted to size-capped, non-executable tmpfs mounts (`/tmp`).

---

## 7. Security Acceptance Verification Matrix

| Check | Target Requirement | Verified Result | Compliance |
| :--- | :--- | :--- | :--- |
| **Static Code Analysis** | Bandit SAST: 0 High, 0 Medium issues | **0 Issues** across all source files | **PASS** |
| **Dependency Scanning** | pip-audit & npm audit | **0 Critical Vulnerabilities** | **PASS** |
| **Authentication Rigor** | Argon2id + HS256 JWT + claims validation | Complete claim checking (`sub`, `roles`, `iss`, `aud`, `jti`, `exp`) | **PASS** |
| **Multi-Tenant Isolation** | SQL query-level IDOR enforcement | Analysts restricted strictly to assigned/owned incidents | **PASS** |
| **Secret Management** | Zero committed credentials | `.env` ignored; `.env.example` contains placeholders only | **PASS** |
| **Container Security** | Read-only rootfs, dropped capabilities | Enforced across PostgreSQL, Redis, Backend, Frontend | **PASS** |
| **Automated Regression Suite** | 100% test pass rate | **19/19 passing tests** in automated pytest suite | **PASS** |

---

## 8. Responsible Disclosure & Reporting

For security disclosures, vulnerability reporting, or enterprise architecture inquiries, contact the security lead via the repository issue tracker or authorized operator channels.
