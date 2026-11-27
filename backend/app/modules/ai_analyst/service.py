"""AI Threat Analyst service integrating Google Gemini for deep threat synthesis."""
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.config import settings
from app.modules.auth.models import User
from app.modules.indicators.models import IOCInvestigationRecord
from app.modules.indicators.schemas import IOCEnrichmentRequest
from app.modules.indicators.investigation_service import investigate_ioc_coordinator
from app.modules.ai_analyst.models import AIThreatAnalysis
from app.modules.ai_analyst.schemas import (
    AIAnalysisRequest,
    AIAnalysisResponse,
    AIAnalysisDetailSchema,
    AIAnalysisListItem,
    MitreTechniqueSchema,
)
from app.modules.audit.service import record_audit_log

logger = logging.getLogger(__name__)

SUPPORTED_GEMINI_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
]

ANALYSIS_SYSTEM_PROMPT = """You are ThreatNex's Senior Cyber Threat Intelligence Analyst and Incident Response Architect.
Your task is to analyze real multi-provider threat intelligence telemetry collected for an Indicator of Compromise (IOC).

STRICT SOC GUIDELINES:
1. Base all observations strictly on the actual telemetry provided from VirusTotal, AbuseIPDB, AlienVault OTX, and URLhaus.
2. NEVER fabricate evidence, CVE numbers, malware families, or APT group attributions not present in the verified evidence or known canonical infrastructure (e.g. Google Public DNS 8.8.8.8, Cloudflare 1.1.1.1).
3. If an intelligence provider was unconfigured, timed out, or returned an error, state clearly that telemetry was unavailable — NEVER assume it was clean or malicious.
4. Strictly differentiate between 'confirmed_evidence' (verified factual telemetry from engines) and 'hypotheses' (plausible threat scenarios or attacker intentions).
5. Address false-positive scenarios (e.g. shared CDN infrastructure, legitimate public DNS, cloud egress IP, expired domain).
6. Map relevant MITRE ATT&CK techniques with technique ID (e.g. T1071.001), name, tactic, specific observable evidence, and confidence.
7. Provide prioritized, actionable investigation steps and immediate containment actions.

Respond ONLY with valid JSON matching this schema:
{
  "executive_summary": "Concise 2-3 sentence executive threat briefing",
  "threat_classification": "Brief classification, e.g. 'Legitimate Public DNS Resolver', 'Active Cobalt Strike C2 Domain', 'Phishing Landing Page'",
  "reasoning": "Detailed technical analysis detailing how provider findings were evaluated",
  "risk_level": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN" | "UNKNOWN",
  "confidence_score": 0.0 to 100.0,
  "provider_evidence_summary": {
    "VirusTotal": "summary of findings",
    "AbuseIPDB": "summary of findings",
    "AlienVault OTX": "summary of findings",
    "URLhaus": "summary of findings"
  },
  "confirmed_evidence": ["list of verified factual points from providers"],
  "hypotheses": ["list of plausible hypotheses or contextual considerations"],
  "false_positive_analysis": "Detailed false-positive risk and benign likelihood evaluation",
  "recommended_investigation_steps": ["step 1", "step 2", ...],
  "recommended_containment_actions": ["action 1", "action 2", ...],
  "mitre_techniques": [
    {
      "technique_id": "Txxxx.xxx",
      "technique_name": "Technique Name",
      "tactic": "Tactic Name",
      "evidence": "Specific observable evidence connecting this IOC to the technique",
      "confidence": "High" | "Medium" | "Low"
    }
  ],
  "analyst_conclusion": "Final wrap-up and decisive recommendation for SOC triage"
}
"""


async def _call_gemini_generate(prompt: str) -> Tuple[Dict[str, Any], str]:
    """Calls Gemini with automatic model failover and JSON parsing."""
    api_key = settings.GEMINI_API_KEY
    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API key is not configured in backend environment (GEMINI_API_KEY).",
        )

    last_error = None
    for model in SUPPORTED_GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.15,
                "maxOutputTokens": 2500,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise ValueError("No candidates returned from Gemini API")
                    raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    parsed_json = json.loads(raw_text)
                    return parsed_json, model
                elif res.status_code == 429:
                    last_error = f"Model {model} rate limited (HTTP 429)"
                    logger.warning(last_error)
                elif res.status_code == 404:
                    last_error = f"Model {model} unavailable (HTTP 404)"
                    logger.warning(last_error)
                else:
                    last_error = f"Model {model} error HTTP {res.status_code}: {res.text[:120]}"
                    logger.warning(last_error)
        except json.JSONDecodeError as jde:
            logger.error(f"Failed to parse Gemini JSON output: {jde}")
            last_error = f"Failed to parse model response: {jde}"
        except httpx.TimeoutException:
            last_error = f"Model {model} request timed out"
            logger.warning(last_error)
        except Exception as ex:
            last_error = f"Gemini invocation exception: {str(ex)}"
            logger.error(last_error)

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Gemini Threat Analyst generation failed across available models. Last error: {last_error}",
    )


async def execute_ai_threat_analysis(
    db: AsyncSession,
    req: AIAnalysisRequest,
    current_user: User,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AIAnalysisResponse:
    """
    Coordinates gathering actual investigation telemetry, prompting Gemini,
    persisting the structured report, and logging the audit event.
    """
    investigation_id = req.investigation_id
    investigation_record: Optional[IOCInvestigationRecord] = None

    # 1. Resolve or execute investigation
    if investigation_id:
        stmt = select(IOCInvestigationRecord).where(IOCInvestigationRecord.id == investigation_id)
        investigation_record = (await db.execute(stmt)).scalar_one_or_none()
        if not investigation_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Investigation record '{investigation_id}' not found.",
            )
        indicator_value = investigation_record.indicator_value
        ioc_type = investigation_record.ioc_type.value
        raw_telemetry = investigation_record.raw_results_json
        verdict = investigation_record.verdict
        severity = investigation_record.severity.value
        confidence = investigation_record.confidence
        total_detections = investigation_record.total_detections
        summary = investigation_record.summary
    elif req.indicator_value:
        indicator_value = req.indicator_value.strip()
        # Look up existing investigation for this value
        stmt = (
            select(IOCInvestigationRecord)
            .where(IOCInvestigationRecord.indicator_value == indicator_value)
            .order_by(desc(IOCInvestigationRecord.created_at))
        )
        investigation_record = (await db.execute(stmt)).scalars().first()

        if not investigation_record:
            # Execute live investigation to get real multi-provider data
            enrich_resp = await investigate_ioc_coordinator(
                db=db,
                req=IOCEnrichmentRequest(value=indicator_value, save_to_inventory=True),
                current_user=current_user,
                client_ip=client_ip,
                user_agent=user_agent,
            )
            # Fetch the newly recorded investigation
            stmt = (
                select(IOCInvestigationRecord)
                .where(IOCInvestigationRecord.indicator_value == indicator_value)
                .order_by(desc(IOCInvestigationRecord.created_at))
            )
            investigation_record = (await db.execute(stmt)).scalars().first()

        if investigation_record:
            investigation_id = investigation_record.id
            ioc_type = investigation_record.ioc_type.value
            raw_telemetry = investigation_record.raw_results_json
            verdict = investigation_record.verdict
            severity = investigation_record.severity.value
            confidence = investigation_record.confidence
            total_detections = investigation_record.total_detections
            summary = investigation_record.summary
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to gather threat intelligence for this observable.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must specify either investigation_id or indicator_value.",
        )

    # 2. Parse verified provider evidence for Gemini prompt
    providers_data = []
    if raw_telemetry:
        try:
            providers_data = json.loads(raw_telemetry)
        except Exception:
            providers_data = [{"error": "Raw telemetry parsing failed"}]

    prompt_context = {
        "target_observable": indicator_value,
        "ioc_type": ioc_type,
        "heuristic_verdict": verdict,
        "heuristic_severity": severity,
        "heuristic_confidence": confidence,
        "total_detections": total_detections,
        "existing_summary": summary,
        "providers_telemetry": providers_data,
    }

    full_prompt = (
        f"{ANALYSIS_SYSTEM_PROMPT}\n\n"
        f"ANALYZE THIS REAL INVESTIGATION TELEMETRY:\n"
        f"{json.dumps(prompt_context, indent=2)}\n\n"
        f"Generate the comprehensive AI threat analysis JSON:"
    )

    # 3. Call Gemini
    parsed_analysis, used_model = await _call_gemini_generate(full_prompt)

    # 4. Extract key fields with validation
    exec_summary = parsed_analysis.get("executive_summary") or "AI Threat Assessment completed."
    threat_class = parsed_analysis.get("threat_classification") or "Unclassified Observable"
    risk_level = str(parsed_analysis.get("risk_level") or severity).upper()
    confidence_val = float(parsed_analysis.get("confidence_score") or confidence or 70.0)

    # 5. Build validated schema
    mitre_list = []
    for m in parsed_analysis.get("mitre_techniques", []):
        if isinstance(m, dict) and m.get("technique_id") and m.get("technique_name"):
            mitre_list.append(
                MitreTechniqueSchema(
                    technique_id=m["technique_id"],
                    technique_name=m["technique_name"],
                    tactic=m.get("tactic", "Unknown"),
                    evidence=m.get("evidence", "Observable correlated with technique"),
                    confidence=m.get("confidence", "Medium"),
                )
            )

    details_schema = AIAnalysisDetailSchema(
        executive_summary=exec_summary,
        threat_classification=threat_class,
        reasoning=parsed_analysis.get("reasoning", ""),
        risk_level=risk_level,
        confidence_score=confidence_val,
        provider_evidence_summary=parsed_analysis.get("provider_evidence_summary", {}),
        confirmed_evidence=parsed_analysis.get("confirmed_evidence", []),
        hypotheses=parsed_analysis.get("hypotheses", []),
        false_positive_analysis=parsed_analysis.get("false_positive_analysis", ""),
        recommended_investigation_steps=parsed_analysis.get("recommended_investigation_steps", []),
        recommended_containment_actions=parsed_analysis.get("recommended_containment_actions", []),
        mitre_techniques=mitre_list,
        analyst_conclusion=parsed_analysis.get("analyst_conclusion", ""),
    )

    # 6. Persist in PostgreSQL
    db_analysis = AIThreatAnalysis(
        investigation_id=investigation_id,
        indicator_value=indicator_value,
        ioc_type=ioc_type,
        model_name=used_model,
        risk_level=risk_level,
        threat_classification=threat_class,
        confidence_score=confidence_val,
        executive_summary=exec_summary,
        full_analysis_json=json.dumps(details_schema.model_dump(), default=str),
        operator_id=current_user.id,
    )
    db.add(db_analysis)
    await db.flush()

    # 7. Audit Log
    await record_audit_log(
        db=db,
        action="AI_THREAT_ANALYSIS",
        resource_type="AI_ANALYSIS",
        resource_id=db_analysis.id,
        user_id=current_user.id,
        ip_address=client_ip,
        user_agent=user_agent,
        details=f"Generated AI Threat Analysis for {ioc_type.upper()} '{indicator_value}' using {used_model}: {risk_level} ({threat_class})",
    )

    await db.commit()
    await db.refresh(db_analysis)

    return AIAnalysisResponse(
        id=db_analysis.id,
        investigation_id=db_analysis.investigation_id,
        indicator_value=db_analysis.indicator_value,
        ioc_type=db_analysis.ioc_type,
        model_name=db_analysis.model_name,
        risk_level=db_analysis.risk_level,
        threat_classification=db_analysis.threat_classification,
        confidence_score=db_analysis.confidence_score,
        executive_summary=db_analysis.executive_summary,
        analysis_details=details_schema,
        operator_id=db_analysis.operator_id,
        created_at=db_analysis.created_at,
    )


async def list_ai_analyses(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> List[AIAnalysisListItem]:
    """Retrieves paginated list of previous AI threat analyses."""
    stmt = (
        select(AIThreatAnalysis)
        .order_by(desc(AIThreatAnalysis.created_at))
        .offset(offset)
        .limit(limit)
    )
    results = (await db.execute(stmt)).scalars().all()
    return [AIAnalysisListItem.model_validate(r) for r in results]


async def get_ai_analysis_by_id(
    db: AsyncSession,
    analysis_id: str,
) -> AIAnalysisResponse:
    """Retrieves a single full AI threat analysis by ID."""
    stmt = select(AIThreatAnalysis).where(AIThreatAnalysis.id == analysis_id)
    analysis = (await db.execute(stmt)).scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI Threat Analysis with ID '{analysis_id}' not found.",
        )

    parsed_details = json.loads(analysis.full_analysis_json)
    return AIAnalysisResponse(
        id=analysis.id,
        investigation_id=analysis.investigation_id,
        indicator_value=analysis.indicator_value,
        ioc_type=analysis.ioc_type,
        model_name=analysis.model_name,
        risk_level=analysis.risk_level,
        threat_classification=analysis.threat_classification,
        confidence_score=analysis.confidence_score,
        executive_summary=analysis.executive_summary,
        analysis_details=AIAnalysisDetailSchema.model_validate(parsed_details),
        operator_id=analysis.operator_id,
        created_at=analysis.created_at,
    )
