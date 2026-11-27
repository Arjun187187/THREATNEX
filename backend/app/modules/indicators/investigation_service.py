"""IOC Investigation & Threat Intelligence Coordinator Service."""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.modules.auth.models import User
from app.modules.indicators.models import (
    Indicator,
    IOCType,
    IOCSeverity,
    IOCInvestigationRecord,
)
from app.modules.indicators.schemas import (
    IOCEnrichmentRequest,
    IOCEnrichmentResponse,
    ProviderResultSchema,
    IOCInvestigationHistoryResponse,
)
from app.modules.indicators.validator import validate_ioc_value
from app.modules.indicators.providers import (
    VirusTotalProvider,
    AbuseIPDBProvider,
    AlienVaultOTXProvider,
    URLhausProvider,
    ProviderResult,
    ProviderStatus,
)
from app.modules.audit.service import record_audit_log

logger = logging.getLogger(__name__)


def _compute_severity_and_verdict(
    results: List[ProviderResult],
) -> Tuple[str, IOCSeverity, float, int, List[str]]:
    """
    Synthesizes overall verdict, severity, confidence, detection count, and tags
    from real responding threat intelligence providers.
    NEVER fabricates scores or fake detections if providers are unconfigured or fail.
    """
    total_malicious = sum(r.malicious for r in results if r.supported and r.status == ProviderStatus.SUCCESS)
    total_suspicious = sum(r.suspicious for r in results if r.supported and r.status == ProviderStatus.SUCCESS)
    total_harmless = sum(r.harmless for r in results if r.supported and r.status == ProviderStatus.SUCCESS)

    all_tags = []
    confidence_scores = []
    responding_count = 0

    has_malicious = False
    has_suspicious = False
    has_clean = False

    for r in results:
        if not r.supported:
            continue
        if r.status in (ProviderStatus.SUCCESS, ProviderStatus.NOT_FOUND, ProviderStatus.CLEAN):
            responding_count += 1
            if r.tags:
                all_tags.extend(r.tags)
            if r.confidence_score is not None:
                confidence_scores.append(r.confidence_score)

            if r.verdict == "malicious":
                has_malicious = True
            elif r.verdict == "suspicious":
                has_suspicious = True
            elif r.verdict == "clean":
                has_clean = True

    # Deduplicate tags preserving order
    dedup_tags = list(dict.fromkeys(all_tags))

    # Overall Verdict
    if has_malicious:
        overall_verdict = "malicious"
    elif has_suspicious:
        overall_verdict = "suspicious"
    elif has_clean:
        overall_verdict = "clean"
    else:
        overall_verdict = "unknown"

    # Overall Severity
    if overall_verdict == "malicious":
        if total_malicious >= 5:
            calculated_severity = IOCSeverity.CRITICAL
        elif total_malicious >= 2:
            calculated_severity = IOCSeverity.HIGH
        else:
            calculated_severity = IOCSeverity.MEDIUM
    elif overall_verdict == "suspicious":
        calculated_severity = IOCSeverity.MEDIUM
    elif overall_verdict == "clean":
        calculated_severity = IOCSeverity.LOW
    else:
        calculated_severity = IOCSeverity.UNKNOWN

    # Confidence calculation
    if confidence_scores:
        overall_confidence = round(sum(confidence_scores) / len(confidence_scores), 1)
    else:
        overall_confidence = 0.0

    total_detections = total_malicious + total_suspicious

    return overall_verdict, calculated_severity, overall_confidence, total_detections, dedup_tags


def _build_summary(
    clean_val: str,
    ioc_type: IOCType,
    verdict: str,
    severity: IOCSeverity,
    confidence: float,
    detections: int,
    results: List[ProviderResult],
) -> str:
    """Generates an executive summary based on actual provider findings."""
    provider_summaries = []
    for r in results:
        if not r.supported:
            continue
        if r.status == ProviderStatus.SUCCESS:
            provider_summaries.append(f"{r.provider}: {r.message}")
        elif r.status == ProviderStatus.NOT_FOUND:
            provider_summaries.append(f"{r.provider}: clean (0 telemetry matches)")
        elif r.status == ProviderStatus.UNCONFIGURED:
            provider_summaries.append(f"{r.provider}: API key not configured")
        elif r.status in (ProviderStatus.TIMEOUT, ProviderStatus.RATE_LIMITED, ProviderStatus.ERROR):
            provider_summaries.append(f"{r.provider}: {r.status.value} ({r.message or 'query failed'})")

    finding_str = "; ".join(provider_summaries) if provider_summaries else "No responding providers."
    return (
        f"Indicator '{clean_val}' ({ioc_type.value.upper()}) evaluated as {verdict.upper()} "
        f"with {severity.value.upper()} severity ({confidence}% confidence, {detections} detections). "
        f"Findings: {finding_str}"
    )


async def investigate_ioc_coordinator(
    db: AsyncSession,
    req: IOCEnrichmentRequest,
    current_user: User,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> IOCEnrichmentResponse:
    """
    Coordinates multi-provider threat intelligence enrichment, synthesis,
    database record creation / updating, and audit logging.
    """
    clean_val = req.value.strip()

    # 1. Validate & classify
    is_valid, detected_type, val_msg = validate_ioc_value(clean_val, req.expected_type)
    if not is_valid or not detected_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid IOC format: {val_msg}",
        )

    # 2. Initialize Providers
    providers = [
        VirusTotalProvider(),
        AbuseIPDBProvider(),
        AlienVaultOTXProvider(),
        URLhausProvider(),
    ]

    # 3. Query supported providers concurrently with error isolation
    async def query_provider(prov):
        if not prov.supports(detected_type):
            return ProviderResult(
                provider=prov.provider_name,
                supported=False,
                status=ProviderStatus.UNSUPPORTED,
                message=f"{prov.provider_name} does not inspect {detected_type.value} indicators",
                attribution=prov.attribution_source,
            )
        try:
            return await prov.lookup(clean_val, detected_type)
        except Exception as ex:
            logger.error(f"Provider {prov.provider_name} unhandled lookup exception: {ex}")
            return ProviderResult(
                provider=prov.provider_name,
                supported=True,
                status=ProviderStatus.ERROR,
                message=f"Internal provider execution failure: {str(ex)}",
                attribution=prov.attribution_source,
            )

    results: List[ProviderResult] = await asyncio.gather(*(query_provider(p) for p in providers))

    # 4. Synthesize verified telemetry
    verdict, severity, confidence, detections, tags = _compute_severity_and_verdict(results)
    summary = _build_summary(clean_val, detected_type, verdict, severity, confidence, detections, results)

    # 5. Persistence: Check existing or create / update Indicator
    indicator_id = None
    saved_in_inventory = False

    # Check if indicator already exists in PostgreSQL
    existing_stmt = select(Indicator).where(Indicator.value == clean_val)
    existing_indicator = (await db.execute(existing_stmt)).scalar_one_or_none()

    if req.save_to_inventory or existing_indicator:
        tags_str = ",".join(tags) if tags else None
        if existing_indicator:
            # Update existing indicator with fresh intelligence
            existing_indicator.ioc_type = detected_type
            if severity != IOCSeverity.UNKNOWN:
                existing_indicator.severity = severity
            if confidence > 0:
                existing_indicator.confidence = confidence
            existing_indicator.description = summary
            if tags_str:
                existing_indicator.tags = tags_str
            await db.flush()
            indicator_id = existing_indicator.id
            saved_in_inventory = True
        else:
            # Create new indicator
            new_ind = Indicator(
                value=clean_val,
                ioc_type=detected_type,
                severity=severity,
                confidence=confidence,
                description=summary,
                tags=tags_str,
                is_active=True,
            )
            db.add(new_ind)
            await db.flush()
            indicator_id = new_ind.id
            saved_in_inventory = True

    # 6. Record Investigation History
    # Serialize provider results for forensic review
    serialized_results = json.dumps([r.model_dump() for r in results], default=str)

    history_record = IOCInvestigationRecord(
        indicator_value=clean_val,
        ioc_type=detected_type,
        verdict=verdict,
        severity=severity,
        confidence=confidence,
        total_detections=detections,
        summary=summary,
        raw_results_json=serialized_results,
        user_id=current_user.id,
        indicator_id=indicator_id,
    )
    db.add(history_record)
    await db.flush()

    # 7. Audit log event
    await record_audit_log(
        db=db,
        action="IOC_INVESTIGATION",
        resource_type="IOC",
        resource_id=clean_val,
        user_id=current_user.id,
        ip_address=client_ip,
        user_agent=user_agent,
        details=f"Investigated {detected_type.value.upper()} '{clean_val}': {verdict.upper()} ({severity.value.upper()}, {detections} detections)",
    )

    await db.commit()
    await db.refresh(history_record)

    # 8. Format schemas for response
    provider_schemas = [
        ProviderResultSchema(
            provider=r.provider,
            supported=r.supported,
            status=r.status.value,
            message=r.message,
            attribution=r.attribution,
            source_timestamp=r.source_timestamp,
            malicious=r.malicious,
            suspicious=r.suspicious,
            harmless=r.harmless,
            undetected=r.undetected,
            reputation_score=r.reputation_score,
            confidence_score=r.confidence_score,
            verdict=r.verdict,
            tags=r.tags,
            evidence=r.evidence,
        )
        for r in results
    ]

    return IOCEnrichmentResponse(
        value=clean_val,
        normalized_value=clean_val,
        ioc_type=detected_type,
        is_valid=True,
        queried_at=datetime.now(timezone.utc),
        overall_verdict=verdict,
        calculated_severity=severity,
        overall_confidence=confidence,
        total_detections=detections,
        summary=summary,
        tags=tags,
        providers=provider_schemas,
        saved_in_inventory=saved_in_inventory,
        indicator_id=indicator_id,
        investigation_record_id=history_record.id,
    )


async def get_investigation_history(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> List[IOCInvestigationHistoryResponse]:
    """Retrieves paginated history of previous IOC investigations."""
    stmt = (
        select(IOCInvestigationRecord)
        .order_by(desc(IOCInvestigationRecord.created_at))
        .offset(offset)
        .limit(limit)
    )
    results = (await db.execute(stmt)).scalars().all()
    return [IOCInvestigationHistoryResponse.model_validate(r) for r in results]
