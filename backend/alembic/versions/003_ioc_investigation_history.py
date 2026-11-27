"""Add ioc_investigations table for historical investigation records.

Revision ID: 003_ioc_investigation_history
Revises: 002_refresh_token_rotation
Create Date: 2026-11-27 11:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003_ioc_investigation_history'
down_revision: Union[str, None] = '002_refresh_token_rotation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ioc_investigations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('indicator_value', sa.String(500), nullable=False),
        sa.Column('ioc_type', sa.String(50), nullable=False),
        sa.Column('verdict', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(50), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('total_detections', sa.Integer(), nullable=False, default=0),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('raw_results_json', sa.Text(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('indicator_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_ioc_investigations_indicator_value', 'ioc_investigations', ['indicator_value'])
    op.create_index('ix_ioc_investigations_ioc_type', 'ioc_investigations', ['ioc_type'])
    op.create_index('ix_ioc_investigations_user_id', 'ioc_investigations', ['user_id'])
    op.create_index('ix_ioc_investigations_indicator_id', 'ioc_investigations', ['indicator_id'])


def downgrade() -> None:
    op.drop_table('ioc_investigations')
