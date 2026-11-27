# THREATNEX Automation & Utility Scripts

This directory contains automated verification, maintenance, and documentation scripts for the THREATNEX platform.

---

## 1. `verify_e2e_workflows.py`
Automated end-to-end regression verification script validating all 11 core user workflows:
1. Operator authentication & profile access.
2. Real-time multi-provider IOC investigation.
3. Threat feed retrieval, severity filtering, and manual sync.
4. Feed-to-IOC investigation pivot.
5. Google Gemini AI threat reasoning & history.
6. Threat watchlist creation, indicator enrollment, and indicator removal.
7. Security alert generation from investigation.
8. Alert triage lifecycle (acknowledge, resolve with notes, escalate to case).
9. Threat report generation and export.
10. Compliance audit trail retrieval and action filtering.
11. Administrative risk score matrix and alert threshold updates.

### Execution:
```bash
# Executing from root directory with active backend environment:
python scripts/verify_e2e_workflows.py

# Or piping directly into running Docker backend container:
Get-Content scripts/verify_e2e_workflows.py -Raw | docker exec -i -e PYTHONPATH=/app threatnex_backend python3 -
```

---

## 2. `capture_screenshots.js`
Automated headless browser screenshot capture utility using Chrome DevTools Protocol (CDP). Authenticates with the live backend, injects session cookies, navigates through all 11 application routes, and outputs high-resolution viewport captures into `docs/screenshots/`.

### Execution:
```bash
node scripts/capture_screenshots.js
```
