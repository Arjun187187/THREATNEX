"""Add ai_analyses table for AI Threat Analyst reports.

Revision ID: 004_ai_threat_analyst
Revises: 003_ioc_investigation_history
Create Date: 2026-11-27 13:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_ai_threat_analyst'
down_revision: Union[str, None] = '003_ioc_investigation_history'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_analyses',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('investigation_id', sa.String(), nullable=True),
        sa.Column('indicator_value', sa.String(500), nullable=False),
        sa.Column('ioc_type', sa.String(50), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('risk_level', sa.String(50), nullable=False),
        sa.Column('threat_classification', sa.String(255), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False, default=0.0),
        sa.Column('executive_summary', sa.Text(), nullable=False),
        sa.Column('full_analysis_json', sa.Text(), nullable=False),
        sa.Column('operator_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_ai_analyses_indicator_val', 'ai_analyses', ['indicator_value'])
    op.create_index('ix_ai_analyses_operator', 'ai_analyses', ['operator_id'])
    op.create_index('ix_ai_analyses_investigation_id', 'ai_analyses', ['investigation_id'])


def downgrade() -> None:
    op.drop_table('ai_analyses')
