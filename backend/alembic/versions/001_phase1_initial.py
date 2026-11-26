"""Initial Phase 1 Schema: Users, Roles, Indicators, Investigations, Audit Logs.

Revision ID: 001_phase1_initial
Revises: 
Create Date: 2026-11-26 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_phase1_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Roles table
    op.create_table(
        'roles',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('description', sa.String(255), nullable=True),
    )
    op.create_index('ix_roles_name', 'roles', ['name'])

    # 2. Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('username', sa.String(100), nullable=False, unique=True),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('is_verified', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_username', 'users', ['username'])

    # 3. User roles association table
    op.create_table(
        'user_roles',
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id', sa.String(), sa.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    )

    # 4. Indicators table
    op.create_table(
        'indicators',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('value', sa.String(500), nullable=False, unique=True),
        sa.Column('ioc_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(50), nullable=False),
        sa.Column('confidence', sa.Float(), default=0.0, nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tags', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_indicators_value', 'indicators', ['value'])
    op.create_index('ix_indicators_ioc_type', 'indicators', ['ioc_type'])

    # 5. Investigations table
    op.create_table(
        'investigations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('priority', sa.String(50), nullable=False),
        sa.Column('owner_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_to', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_investigations_status', 'investigations', ['status'])

    # 6. Investigation Indicators association table
    op.create_table(
        'investigation_indicators',
        sa.Column('investigation_id', sa.String(), sa.ForeignKey('investigations.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('indicator_id', sa.String(), sa.ForeignKey('indicators.id', ondelete='CASCADE'), primary_key=True),
    )

    # 7. Audit Logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(100), nullable=False),
        sa.Column('resource_id', sa.String(100), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(255), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('investigation_indicators')
    op.drop_table('investigations')
    op.drop_table('indicators')
    op.drop_table('user_roles')
    op.drop_table('users')
    op.drop_table('roles')
