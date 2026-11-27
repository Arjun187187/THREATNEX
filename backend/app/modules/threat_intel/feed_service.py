"""Threat Intelligence Feed ingestion and query services."""
import json
import logging
import time
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.core.config import settings
from app.modules.threat_intel.models import ThreatFeedItem, FeedSyncLog
from app.modules.threat_intel.schemas import (
    ThreatFeedItemResponse,
    ThreatFeedListResponse,
    FeedProviderStatus,
    FeedStatsResponse,
    ProviderSyncResult,
    FeedSyncResponse,
)

logger = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = [
    "AlienVault OTX",
    "URLhaus",
    "CISA KEV",
    "AbuseIPDB",
    "VirusTotal",
]

PROVIDER_ATTRIBUTIONS = {
    "AlienVault OTX": "AT&T Cybersecurity AlienVault Open Threat Exchange (OTX Pulses)",
    "URLhaus": "abuse.ch URLhaus Real-time Malware Feed",
    "CISA KEV": "CISA Known Exploited Vulnerabilities (KEV) Catalog",
    "AbuseIPDB": "AbuseIPDB High-Confidence Malicious IP Blacklist",
    "VirusTotal": "VirusTotal v3 Intelligence & Threat Categorization",
}


def _parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        # Standard ISO or space separated
        clean = dt_str.replace("Z", "+00:00")
        if " " in clean and "+" not in clean and "-" not in clean[10:]:
            clean = clean.replace(" ", "T") + "+00:00"
        return datetime.fromisoformat(clean)
    except Exception:
        return datetime.now(timezone.utc)


async def _upsert_feed_item(
    db: AsyncSession,
    indicator_value: str,
    ioc_type: str,
    provider: str,
    source_feed: Optional[str],
    threat_category: str,
    severity: str,
    confidence: float,
    description: Optional[str] = None,
    tags: Optional[str] = None,
    external_reference: Optional[str] = None,
    first_seen: Optional[datetime] = None,
    last_seen: Optional[datetime] = None,
    raw_metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Inserts a new feed item or updates an existing item for (provider, indicator_value) atomically.
    """
    now = datetime.now(timezone.utc)
    metadata_str = json.dumps(raw_metadata, default=str) if raw_metadata else None
    item_id = str(uuid.uuid4())

    insert_stmt = pg_insert(ThreatFeedItem).values(
        id=item_id,
        indicator_value=indicator_value,
        ioc_type=ioc_type.lower(),
        provider=provider,
        source_feed=source_feed,
        threat_category=threat_category,
        severity=severity.lower(),
        confidence=confidence,
        description=description,
        tags=tags,
        external_reference=external_reference,
        first_seen=first_seen or now,
        last_seen=last_seen or now,
        raw_metadata_json=metadata_str,
        is_active=True,
        created_at=now,
        updated_at=now,
    )

    upsert_stmt = insert_stmt.on_conflict_do_update(
        constraint="uq_threat_feed_provider_indicator",
        set_={
            "last_seen": func.coalesce(insert_stmt.excluded.last_seen, now),
            "threat_category": insert_stmt.excluded.threat_category,
            "severity": insert_stmt.excluded.severity,
            "confidence": func.greatest(ThreatFeedItem.confidence, insert_stmt.excluded.confidence),
            "description": func.coalesce(insert_stmt.excluded.description, ThreatFeedItem.description),
            "tags": insert_stmt.excluded.tags,
            "external_reference": func.coalesce(insert_stmt.excluded.external_reference, ThreatFeedItem.external_reference),
            "raw_metadata_json": func.coalesce(insert_stmt.excluded.raw_metadata_json, ThreatFeedItem.raw_metadata_json),
            "updated_at": now,
        },
    )
    await db.execute(upsert_stmt)
    return True


# -------------------------------------------------------------------------
# PROVIDER 1: CISA Known Exploited Vulnerabilities (KEV)
# -------------------------------------------------------------------------
async def ingest_cisa_kev(db: AsyncSession, limit: int = 50) -> Tuple[int, int]:
    """Ingests official CISA Known Exploited Vulnerabilities (KEV)."""
    url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
    headers = {"User-Agent": "ThreatNex-SOC/1.0", "Accept": "application/json"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    vulns = data.get("vulnerabilities", [])
    # Sort or take the most recently added vulnerabilities
    vulns_subset = vulns[:limit] if limit > 0 else vulns

    ingested = 0
    updated = 0

    for item in vulns_subset:
        cve_id = item.get("cveID", "").strip()
        if not cve_id:
            continue

        vendor = item.get("vendorProject", "Unknown")
        product = item.get("product", "Unknown")
        vuln_name = item.get("vulnerabilityName", "")
        short_desc = item.get("shortDescription", "")
        action = item.get("requiredAction", "")
        ransomware_use = item.get("knownRansomwareCampaignUse", "Unknown")
        date_added = _parse_iso_datetime(item.get("dateAdded"))

        severity = "critical" if ransomware_use.lower() == "known" else "high"
        confidence = 95.0

        tags_list = ["cve", "cisa_kev", "exploited_in_wild", vendor.lower(), product.lower()]
        if ransomware_use.lower() == "known":
            tags_list.append("ransomware_associated")

        desc_text = f"[{vendor} {product}] {vuln_name}. {short_desc} Action Required: {action}"
        ref = f"https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext={cve_id}"

        is_new = await _upsert_feed_item(
            db=db,
            indicator_value=cve_id,
            ioc_type="cve",
            provider="CISA KEV",
            source_feed="CISA Known Exploited Vulnerabilities Catalog",
            threat_category="Known Exploited Vulnerability",
            severity=severity,
            confidence=confidence,
            description=desc_text,
            tags=",".join([t for t in tags_list if t]),
            external_reference=ref,
            first_seen=date_added,
            last_seen=date_added,
            raw_metadata=item,
        )
        if is_new:
            ingested += 1
        else:
            updated += 1

    await db.commit()
    return ingested, updated


# -------------------------------------------------------------------------
# PROVIDER 2: URLhaus (abuse.ch)
# -------------------------------------------------------------------------
async def ingest_urlhaus(db: AsyncSession, limit: int = 40) -> Tuple[int, int]:
    """Ingests real-time malicious URLs and payloads from abuse.ch URLhaus."""
    headers = {"User-Agent": "ThreatNex-SOC/1.0"}
    if settings.URLHAUS_AUTH_KEY and settings.URLHAUS_AUTH_KEY.strip() not in ("", "None"):
        headers["Auth-Key"] = settings.URLHAUS_AUTH_KEY.strip()

    urls_endpoint = f"https://urlhaus-api.abuse.ch/v1/urls/recent/limit/{limit}/"
    payloads_endpoint = "https://urlhaus-api.abuse.ch/v1/payloads/recent/limit/20/"

    ingested = 0
    updated = 0

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Fetch URLs
        try:
            resp = await client.get(urls_endpoint, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                for u in data.get("urls", []):
                    val = u.get("url", "").strip()
                    if not val:
                        continue
                    threat = u.get("threat") or "Malware Download"
                    reporter = u.get("reporter", "abuse.ch")
                    url_status = u.get("url_status", "online")
                    date_added = _parse_iso_datetime(u.get("date_added"))
                    tags = u.get("tags") or []
                    ref = u.get("urlhaus_reference")

                    is_new = await _upsert_feed_item(
                        db=db,
                        indicator_value=val,
                        ioc_type="url",
                        provider="URLhaus",
                        source_feed="abuse.ch URLhaus Live URL Feed",
                        threat_category=threat.replace("_", " ").title(),
                        severity="high",
                        confidence=85.0,
                        description=f"Active malware distribution URL reported by {reporter}. Status: {url_status}",
                        tags=",".join(tags) if isinstance(tags, list) else str(tags),
                        external_reference=ref,
                        first_seen=date_added,
                        last_seen=date_added,
                        raw_metadata=u,
                    )
                    if is_new:
                        ingested += 1
                    else:
                        updated += 1
        except Exception as e:
            logger.warning("URLhaus URL ingest partial warning: %s", e)

        # Fetch Payloads (file hashes)
        try:
            p_resp = await client.get(payloads_endpoint, headers=headers)
            if p_resp.status_code == 200:
                p_data = p_resp.json()
                for p in p_data.get("payloads", []):
                    sha256 = p.get("sha256_hash", "").strip()
                    if not sha256:
                        continue
                    sig = p.get("signature") or "Generic Malware"
                    file_type = p.get("file_type") or "Executable"
                    date_added = _parse_iso_datetime(p.get("firstseen"))
                    ref = p.get("urlhaus_download")

                    is_new = await _upsert_feed_item(
                        db=db,
                        indicator_value=sha256,
                        ioc_type="sha256",
                        provider="URLhaus",
                        source_feed="abuse.ch URLhaus Payload Database",
                        threat_category=sig,
                        severity="critical",
                        confidence=90.0,
                        description=f"Identified malware payload: {file_type} ({sig})",
                        tags=f"payload,{file_type.lower()},{sig.lower()}",
                        external_reference=ref,
                        first_seen=date_added,
                        last_seen=date_added,
                        raw_metadata=p,
                    )
                    if is_new:
                        ingested += 1
                    else:
                        updated += 1
        except Exception as e:
            logger.warning("URLhaus Payload ingest partial warning: %s", e)

    await db.commit()
    return ingested, updated


# -------------------------------------------------------------------------
# PROVIDER 3: AlienVault OTX (Open Threat Exchange)
# -------------------------------------------------------------------------
async def ingest_alienvault_otx(db: AsyncSession, pulse_limit: int = 5) -> Tuple[int, int]:
    """Ingests subscribed or recent community threat intelligence pulses from AlienVault OTX."""
    headers = {"User-Agent": "ThreatNex-SOC/1.0", "Accept": "application/json"}
    if settings.ALIENVAULT_OTX_API_KEY and settings.ALIENVAULT_OTX_API_KEY.strip() not in ("", "None"):
        headers["X-OTX-API-KEY"] = settings.ALIENVAULT_OTX_API_KEY.strip()

    endpoints_to_try = [
        f"https://otx.alienvault.com/api/v1/pulses/subscribed?limit={pulse_limit}",
        f"https://otx.alienvault.com/api/v1/search/pulses?q=malware&limit={pulse_limit}",
    ]

    ingested = 0
    updated = 0

    async with httpx.AsyncClient(timeout=12.0) as client:
        pulses = []
        for ep in endpoints_to_try:
            try:
                resp = await client.get(ep, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    pulses = data.get("results", [])
                    if pulses:
                        break
            except Exception as e:
                logger.warning("AlienVault endpoint %s failed: %s", ep, e)

        if not pulses:
            raise RuntimeError("No AlienVault pulses returned from available OTX endpoints.")

        type_map = {
            "IPv4": "ipv4",
            "IPv6": "ipv6",
            "domain": "domain",
            "hostname": "domain",
            "URL": "url",
            "URI": "url",
            "FileHash-SHA256": "sha256",
            "FileHash-MD5": "md5",
            "FileHash-SHA1": "sha1",
            "CVE": "cve",
        }

        for pulse in pulses:
            p_name = pulse.get("name", "Threat Pulse")
            p_desc = pulse.get("description", "")
            p_tags = pulse.get("tags", [])
            p_id = pulse.get("id", "")
            p_created = _parse_iso_datetime(pulse.get("created"))
            p_modified = _parse_iso_datetime(pulse.get("modified")) or p_created
            adversary = pulse.get("adversary") or "Threat Actor"

            indicators = pulse.get("indicators", [])
            # Take up to 10 indicators per pulse to balance coverage
            for ind in indicators[:10]:
                raw_val = ind.get("indicator", "").strip()
                raw_type = ind.get("type", "")
                mapped_type = type_map.get(raw_type)
                if not raw_val or not mapped_type:
                    continue

                ind_created = _parse_iso_datetime(ind.get("created")) or p_created
                ind_tags = p_tags.copy()
                ind_tags.append("alienvault_pulse")

                is_new = await _upsert_feed_item(
                    db=db,
                    indicator_value=raw_val,
                    ioc_type=mapped_type,
                    provider="AlienVault OTX",
                    source_feed=f"Pulse: {p_name[:120]}",
                    threat_category=adversary if adversary != "Threat Actor" else "Threat Pulse Observable",
                    severity="high",
                    confidence=80.0,
                    description=f"{p_name}. {p_desc[:300]}",
                    tags=",".join([t for t in ind_tags if t]),
                    external_reference=f"https://otx.alienvault.com/pulse/{p_id}" if p_id else None,
                    first_seen=ind_created,
                    last_seen=p_modified,
                    raw_metadata={"pulse_name": p_name, "pulse_id": p_id, "indicator": ind},
                )
                if is_new:
                    ingested += 1
                else:
                    updated += 1

    await db.commit()
    return ingested, updated


# -------------------------------------------------------------------------
# PROVIDER 4: AbuseIPDB Blacklist
# -------------------------------------------------------------------------
async def ingest_abuseipdb(db: AsyncSession, limit: int = 30) -> Tuple[int, int]:
    """Ingests high-confidence malicious IPs from AbuseIPDB Blacklist."""
    if not settings.ABUSEIPDB_API_KEY or settings.ABUSEIPDB_API_KEY.strip() in ("", "None"):
        raise ValueError("ABUSEIPDB_API_KEY not configured in backend environment.")

    url = f"https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=95&limit={limit}"
    headers = {
        "Key": settings.ABUSEIPDB_API_KEY.strip(),
        "Accept": "application/json",
        "User-Agent": "ThreatNex-SOC/1.0",
    }

    ingested = 0
    updated = 0

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 429:
            raise RuntimeError("AbuseIPDB request rate limit exceeded.")
        if resp.status_code in (401, 403):
            raise RuntimeError("AbuseIPDB authentication failed. Invalid API key.")
        resp.raise_for_status()

        data = resp.json()
        ip_entries = data.get("data", [])

        for entry in ip_entries:
            ip = entry.get("ipAddress", "").strip()
            if not ip:
                continue

            score = float(entry.get("abuseConfidenceScore", 95))
            country = entry.get("countryCode") or "ZZ"
            reported_at = _parse_iso_datetime(entry.get("lastReportedAt"))
            severity = "critical" if score >= 99 else "high"

            is_new = await _upsert_feed_item(
                db=db,
                indicator_value=ip,
                ioc_type="ipv4",
                provider="AbuseIPDB",
                source_feed="AbuseIPDB 95%+ Confidence Blacklist",
                threat_category="Abusive / Malicious IP",
                severity=severity,
                confidence=score,
                description=f"High-confidence abusive IP address located in {country}. Confidence score: {score:.0f}%.",
                tags=f"abuseipdb,blacklist,{country.lower()}",
                external_reference=f"https://www.abuseipdb.com/check/{ip}",
                first_seen=reported_at,
                last_seen=reported_at,
                raw_metadata=entry,
            )
            if is_new:
                ingested += 1
            else:
                updated += 1

    await db.commit()
    return ingested, updated


# -------------------------------------------------------------------------
# PROVIDER 5: VirusTotal Threat Categorization & Status
# -------------------------------------------------------------------------
async def ingest_virustotal_status(db: AsyncSession) -> Tuple[int, int]:
    """
    Checks VirusTotal status and categorizations.
    Note: Real-time bulk feed requires Enterprise API; this synchronizes active operational telemetry.
    """
    if not settings.VIRUSTOTAL_API_KEY or settings.VIRUSTOTAL_API_KEY.strip() in ("", "None"):
        raise ValueError("VIRUSTOTAL_API_KEY not configured in backend environment.")

    headers = {
        "x-apikey": settings.VIRUSTOTAL_API_KEY.strip(),
        "User-Agent": "ThreatNex-SOC/1.0",
    }
    url = "https://www.virustotal.com/api/v3/popular_threat_categories"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 429:
            raise RuntimeError("VirusTotal API quota or rate limit exceeded.")
        resp.raise_for_status()

    # VirusTotal feed status verified
    return 0, 0


# -------------------------------------------------------------------------
# SYNCHRONIZATION ORCHESTRATION
# -------------------------------------------------------------------------
async def sync_provider_feed(db: AsyncSession, provider_name: str) -> ProviderSyncResult:
    """Synchronizes an individual provider feed with independent error tracking."""
    t0 = time.time()
    ingested = 0
    updated = 0
    status = "operational"
    error_msg: Optional[str] = None

    try:
        if provider_name == "CISA KEV":
            ingested, updated = await ingest_cisa_kev(db)
        elif provider_name == "URLhaus":
            ingested, updated = await ingest_urlhaus(db)
        elif provider_name == "AlienVault OTX":
            ingested, updated = await ingest_alienvault_otx(db)
        elif provider_name == "AbuseIPDB":
            ingested, updated = await ingest_abuseipdb(db)
        elif provider_name == "VirusTotal":
            ingested, updated = await ingest_virustotal_status(db)
            status = "operational"
        else:
            raise ValueError(f"Unknown provider: {provider_name}")
    except Exception as e:
        err_str = str(e)
        logger.error("Threat feed sync failed for %s: %s", provider_name, err_str)
        if "rate limit" in err_str.lower() or "429" in err_str:
            status = "rate_limited"
        elif "not configured" in err_str.lower():
            status = "unconfigured"
        elif "unsupported" in err_str.lower() or "enterprise" in err_str.lower():
            status = "unsupported"
        else:
            status = "failed"
        error_msg = err_str

    duration = (time.time() - t0) * 1000.0

    # Record sync log
    sync_log = FeedSyncLog(
        provider=provider_name,
        status=status,
        items_ingested=ingested,
        items_updated=updated,
        error_message=error_msg,
        duration_ms=round(duration, 2),
    )
    db.add(sync_log)
    await db.commit()

    return ProviderSyncResult(
        provider=provider_name,
        status=status,
        items_ingested=ingested,
        items_updated=updated,
        error=error_msg,
        duration_ms=round(duration, 2),
    )


async def sync_all_threat_feeds(
    db: AsyncSession,
    target_providers: Optional[List[str]] = None,
) -> FeedSyncResponse:
    """Executes scheduled or on-demand synchronization across threat feed providers."""
    providers_to_sync = target_providers or SUPPORTED_PROVIDERS
    results: List[ProviderSyncResult] = []
    total_ingested = 0
    total_updated = 0

    for prov in providers_to_sync:
        res = await sync_provider_feed(db, prov)
        results.append(res)
        total_ingested += res.items_ingested
        total_updated += res.items_updated

    return FeedSyncResponse(
        status="complete",
        message=f"Threat intelligence sync completed: {total_ingested} new, {total_updated} updated across {len(results)} providers.",
        results=results,
        total_ingested=total_ingested,
        total_updated=total_updated,
    )


# -------------------------------------------------------------------------
# QUERIES: FEED ITEMS, STATS & PROVIDER STATUS
# -------------------------------------------------------------------------
async def get_threat_feed_items(
    db: AsyncSession,
    q: Optional[str] = None,
    ioc_type: Optional[str] = None,
    provider: Optional[str] = None,
    severity: Optional[str] = None,
    threat_category: Optional[str] = None,
    min_confidence: Optional[float] = None,
    page: int = 1,
    page_size: int = 25,
) -> ThreatFeedListResponse:
    """Retrieves paginated and filtered threat feed records."""
    filters = [ThreatFeedItem.is_active == True]

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                ThreatFeedItem.indicator_value.ilike(search_pattern),
                ThreatFeedItem.description.ilike(search_pattern),
                ThreatFeedItem.threat_category.ilike(search_pattern),
                ThreatFeedItem.tags.ilike(search_pattern),
            )
        )

    if ioc_type and ioc_type.strip() and ioc_type.lower() != "all":
        filters.append(ThreatFeedItem.ioc_type == ioc_type.strip().lower())

    if provider and provider.strip() and provider.lower() != "all":
        filters.append(ThreatFeedItem.provider == provider.strip())

    if severity and severity.strip() and severity.lower() != "all":
        filters.append(ThreatFeedItem.severity == severity.strip().lower())

    if threat_category and threat_category.strip() and threat_category.lower() != "all":
        filters.append(ThreatFeedItem.threat_category.ilike(f"%{threat_category.strip()}%"))

    if min_confidence is not None and min_confidence > 0:
        filters.append(ThreatFeedItem.confidence >= min_confidence)

    # Count total matching
    count_stmt = select(func.count()).select_from(ThreatFeedItem).where(*filters)
    total = (await db.execute(count_stmt)).scalar() or 0

    # Fetch paginated rows
    offset = (page - 1) * page_size
    stmt = (
        select(ThreatFeedItem)
        .where(*filters)
        .order_by(desc(ThreatFeedItem.last_seen), desc(ThreatFeedItem.created_at))
        .offset(offset)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()

    items = []
    for r in rows:
        tags_list = [t.strip() for t in (r.tags or "").split(",") if t.strip()]
        metadata_dict = None
        if r.raw_metadata_json:
            try:
                metadata_dict = json.loads(r.raw_metadata_json)
            except Exception:
                metadata_dict = {}

        items.append(
            ThreatFeedItemResponse(
                id=r.id,
                indicator_value=r.indicator_value,
                ioc_type=r.ioc_type,
                provider=r.provider,
                source_feed=r.source_feed,
                threat_category=r.threat_category,
                severity=r.severity,
                confidence=r.confidence,
                description=r.description,
                tags=tags_list,
                external_reference=r.external_reference,
                first_seen=r.first_seen,
                last_seen=r.last_seen,
                raw_metadata=metadata_dict,
                is_active=r.is_active,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return ThreatFeedListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_threat_feed_item_by_id(
    db: AsyncSession,
    item_id: str,
) -> Optional[ThreatFeedItemResponse]:
    """Retrieves a single threat feed item by ID."""
    stmt = select(ThreatFeedItem).where(ThreatFeedItem.id == item_id)
    r = (await db.execute(stmt)).scalar_one_or_none()
    if not r:
        return None

    tags_list = [t.strip() for t in (r.tags or "").split(",") if t.strip()]
    metadata_dict = None
    if r.raw_metadata_json:
        try:
            metadata_dict = json.loads(r.raw_metadata_json)
        except Exception:
            metadata_dict = {}

    return ThreatFeedItemResponse(
        id=r.id,
        indicator_value=r.indicator_value,
        ioc_type=r.ioc_type,
        provider=r.provider,
        source_feed=r.source_feed,
        threat_category=r.threat_category,
        severity=r.severity,
        confidence=r.confidence,
        description=r.description,
        tags=tags_list,
        external_reference=r.external_reference,
        first_seen=r.first_seen,
        last_seen=r.last_seen,
        raw_metadata=metadata_dict,
        is_active=r.is_active,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


async def get_feed_provider_statuses(db: AsyncSession) -> List[FeedProviderStatus]:
    """Returns the operational status, last sync time, and count for each provider."""
    statuses = []

    for prov in SUPPORTED_PROVIDERS:
        # Get count of items
        count_stmt = select(func.count()).select_from(ThreatFeedItem).where(
            ThreatFeedItem.provider == prov
        )
        count = (await db.execute(count_stmt)).scalar() or 0

        # Get latest sync log
        log_stmt = (
            select(FeedSyncLog)
            .where(FeedSyncLog.provider == prov)
            .order_by(desc(FeedSyncLog.synced_at))
            .limit(1)
        )
        latest_log = (await db.execute(log_stmt)).scalars().first()

        rate_limit_text = None
        if prov == "VirusTotal":
            rate_limit_text = "Bulk live feeds require VT Enterprise subscription. IOC investigation active via Investigation Engine."
        elif prov == "AbuseIPDB":
            rate_limit_text = "Standard Tier: 1,000 queries/day limit."
        elif prov == "URLhaus":
            rate_limit_text = "Authenticated with abuse.ch Auth-Key."
        elif prov == "AlienVault OTX":
            rate_limit_text = "Authenticated with OTX API Key."
        elif prov == "CISA KEV":
            rate_limit_text = "Public Government Catalog (unrestricted)."

        status_val = latest_log.status if latest_log else "pending"

        statuses.append(
            FeedProviderStatus(
                provider=prov,
                status=status_val,
                last_synced_at=latest_log.synced_at if latest_log else None,
                items_count=count,
                last_error=latest_log.error_message if latest_log else None,
                attribution=PROVIDER_ATTRIBUTIONS.get(prov, prov),
                rate_limit_info=rate_limit_text,
            )
        )

    return statuses


async def get_feed_statistics(db: AsyncSession) -> FeedStatsResponse:
    """Computes overall threat feed aggregations."""
    # Total
    total_stmt = select(func.count()).select_from(ThreatFeedItem)
    total_items = (await db.execute(total_stmt)).scalar() or 0

    # By Severity
    sev_stmt = select(ThreatFeedItem.severity, func.count()).group_by(ThreatFeedItem.severity)
    sev_rows = (await db.execute(sev_stmt)).all()
    by_severity = {r[0]: r[1] for r in sev_rows}

    # By Type
    type_stmt = select(ThreatFeedItem.ioc_type, func.count()).group_by(ThreatFeedItem.ioc_type)
    type_rows = (await db.execute(type_stmt)).all()
    by_type = {r[0]: r[1] for r in type_rows}

    # By Provider
    prov_stmt = select(ThreatFeedItem.provider, func.count()).group_by(ThreatFeedItem.provider)
    prov_rows = (await db.execute(prov_stmt)).all()
    by_provider = {r[0]: r[1] for r in prov_rows}

    # Last Sync Time
    last_sync_stmt = select(func.max(FeedSyncLog.synced_at))
    last_sync_time = (await db.execute(last_sync_stmt)).scalar()

    return FeedStatsResponse(
        total_items=total_items,
        by_severity=by_severity,
        by_type=by_type,
        by_provider=by_provider,
        last_sync_time=last_sync_time,
    )
