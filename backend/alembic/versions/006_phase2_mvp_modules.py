"""Add watchlists, security_alerts, threat_reports, and soc_settings tables.

Revision ID: 006_phase2_mvp_modules
Revises: 005_threat_intel_feed
Create Date: 2026-11-27 16:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_phase2_mvp_modules'
down_revision: Union[str, None] = '005_threat_intel_feed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Watchlists
    op.create_table(
        'watchlists',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(100), nullable=False, server_default='General Threat'),
        sa.Column('severity', sa.String(50), nullable=False, server_default='high'),
        sa.Column('owner_id', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_watchlists_name', 'watchlists', ['name'])
    op.create_index('ix_watchlists_category', 'watchlists', ['category'])

    # 2. Watchlist Indicators
    op.create_table(
        'watchlist_indicators',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('watchlist_id', sa.String(), sa.ForeignKey('watchlists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('indicator_value', sa.String(500), nullable=False),
        sa.Column('ioc_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(50), nullable=False, server_default='high'),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='80.0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('matches_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_matched_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('watchlist_id', 'indicator_value', name='uq_watchlist_indicator'),
    )
    op.create_index('ix_watchlist_indicators_val', 'watchlist_indicators', ['indicator_value'])
    op.create_index('ix_watchlist_indicators_wid', 'watchlist_indicators', ['watchlist_id'])
    op.create_index('ix_watchlist_indicators_status', 'watchlist_indicators', ['status'])

    # 3. Security Alerts
    op.create_table(
        'security_alerts',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('indicator_value', sa.String(500), nullable=False),
        sa.Column('ioc_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(50), nullable=False, server_default='high'),
        sa.Column('status', sa.String(50), nullable=False, server_default='open'),
        sa.Column('source_rule', sa.String(150), nullable=False, server_default='Automated Threat Detection'),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='80.0'),
        sa.Column('assigned_to', sa.String(), nullable=True),
        sa.Column('case_id', sa.String(), sa.ForeignKey('investigations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('raw_evidence_json', sa.Text(), nullable=True),
        sa.Column('acknowledged_by', sa.String(), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.String(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_security_alerts_val', 'security_alerts', ['indicator_value'])
    op.create_index('ix_security_alerts_status', 'security_alerts', ['status'])
    op.create_index('ix_security_alerts_severity', 'security_alerts', ['severity'])
    op.create_index('ix_security_alerts_case_id', 'security_alerts', ['case_id'])

    # 4. Threat Reports
    op.create_table(
        'threat_reports',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('report_type', sa.String(50), nullable=False, server_default='incident_case'),
        sa.Column('reference_id', sa.String(), nullable=True),
        sa.Column('reference_title', sa.String(255), nullable=True),
        sa.Column('author_id', sa.String(), nullable=True),
        sa.Column('executive_summary', sa.Text(), nullable=False),
        sa.Column('content_markdown', sa.Text(), nullable=False),
        sa.Column('content_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_threat_reports_ref_id', 'threat_reports', ['reference_id'])
    op.create_index('ix_threat_reports_type', 'threat_reports', ['report_type'])

    # 5. SOC Policies and Settings
    op.create_table(
        'soc_settings',
        sa.Column('key', sa.String(100), primary_key=True),
        sa.Column('value_json', sa.Text(), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('soc_settings')
    op.drop_table('threat_reports')
    op.drop_table('security_alerts')
    op.drop_table('watchlist_indicators')
    op.drop_table('watchlists')
