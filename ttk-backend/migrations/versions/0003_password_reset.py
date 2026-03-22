"""add password reset tokens and email

Revision ID: 0003
Revises: 0002
Create Date: 2025-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add email column to users
    op.add_column('users',
        sa.Column('email', sa.String(255), nullable=True)
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Create password_reset_tokens table
    op.create_table(
        'password_reset_tokens',
        sa.Column('id',         sa.String(36),  primary_key=True),
        sa.Column('user_id',    sa.String(36),  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token',      sa.String(128), nullable=False, unique=True),
        sa.Column('is_used',    sa.Boolean(),   nullable=False, server_default='false'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
    )
    op.create_index('ix_password_reset_tokens_token', 'password_reset_tokens', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_password_reset_tokens_token', 'password_reset_tokens')
    op.drop_table('password_reset_tokens')
    op.drop_index('ix_users_email', 'users')
    op.drop_column('users', 'email')
