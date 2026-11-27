"""Add threat_feed_items and feed_sync_logs tables for Threat Intel Feed.

Revision ID: 005_threat_intel_feed
Revises: 004_ai_threat_analyst
Create Date: 2026-11-27 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_threat_intel_feed'
down_revision: Union[str, None] = '004_ai_threat_analyst'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'threat_feed_items',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('indicator_value', sa.String(500), nullable=False),
        sa.Column('ioc_type', sa.String(50), nullable=False),
        sa.Column('provider', sa.String(100), nullable=False),
        sa.Column('source_feed', sa.String(200), nullable=True),
        sa.Column('threat_category', sa.String(150), nullable=False, server_default='Threat Indicator'),
        sa.Column('severity', sa.String(50), nullable=False, server_default='high'),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='80.0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tags', sa.String(1000), nullable=True),
        sa.Column('external_reference', sa.String(1000), nullable=True),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('raw_metadata_json', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('provider', 'indicator_value', name='uq_threat_feed_provider_indicator'),
    )
    op.create_index('ix_threat_feed_indicator_value', 'threat_feed_items', ['indicator_value'])
    op.create_index('ix_threat_feed_ioc_type', 'threat_feed_items', ['ioc_type'])
    op.create_index('ix_threat_feed_provider', 'threat_feed_items', ['provider'])
    op.create_index('ix_threat_feed_threat_category', 'threat_feed_items', ['threat_category'])
    op.create_index('ix_threat_feed_severity', 'threat_feed_items', ['severity'])
    op.create_index('ix_threat_feed_last_seen', 'threat_feed_items', ['last_seen'])
    op.create_index('ix_threat_feed_prov_type', 'threat_feed_items', ['provider', 'ioc_type'])

    op.create_table(
        'feed_sync_logs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('provider', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('items_ingested', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('items_updated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('duration_ms', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_feed_sync_provider', 'feed_sync_logs', ['provider'])
    op.create_index('ix_feed_sync_synced_at', 'feed_sync_logs', ['synced_at'])
    op.create_index('ix_feed_sync_prov_date', 'feed_sync_logs', ['provider', 'synced_at'])


def downgrade() -> None:
    op.drop_table('feed_sync_logs')
    op.drop_table('threat_feed_items')
