"""Indicator service for validation, search, and storage."""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from fastapi import HTTPException, status
from app.modules.indicators.models import Indicator, IOCType
from app.modules.indicators.schemas import IOCValidationRequest, IOCValidationResponse, IndicatorCreate
from app.modules.indicators.validator import validate_ioc_value


async def validate_indicator(req: IOCValidationRequest) -> IOCValidationResponse:
    """Validates and detects the IOC format."""
    is_valid, detected_type, msg = validate_ioc_value(req.value, req.expected_type)
    return IOCValidationResponse(
        value=req.value.strip(),
        is_valid=is_valid,
        ioc_type=detected_type,
        message=msg
    )


async def get_or_create_indicator(db: AsyncSession, data: IndicatorCreate) -> Indicator:
    """Validates and stores or retrieves an indicator."""
    val_res = await validate_indicator(IOCValidationRequest(value=data.value, expected_type=data.ioc_type))
    if not val_res.is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid indicator format: {val_res.message}"
        )

    clean_value = val_res.value
    ioc_type = val_res.ioc_type

    stmt = select(Indicator).where(Indicator.value == clean_value)
    result = await db.execute(stmt)
    indicator = result.scalar_one_or_none()

    if not indicator:
        indicator = Indicator(
            value=clean_value,
            ioc_type=ioc_type,
            severity=data.severity,
            confidence=data.confidence,
            description=data.description,
            tags=data.tags,
            is_active=True,
        )
        db.add(indicator)
        await db.commit()
        await db.refresh(indicator)

    return indicator


async def search_indicators(db: AsyncSession, query: str, limit: int = 50) -> List[Indicator]:
    """Searches indicators matching value, type, or tags."""
    clean_q = f"%{query.strip()}%"
    stmt = (
        select(Indicator)
        .where(
            or_(
                Indicator.value.ilike(clean_q),
                Indicator.description.ilike(clean_q),
                Indicator.tags.ilike(clean_q),
            )
        )
        .order_by(Indicator.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
