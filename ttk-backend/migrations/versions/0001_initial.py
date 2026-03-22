"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users
    op.create_table(
        'users',
        sa.Column('id',            sa.String(36),  primary_key=True),
        sa.Column('login',         sa.String(64),  nullable=False, unique=True),
        sa.Column('full_name',     sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_deleted',    sa.Boolean(),   nullable=False, server_default='false'),
        sa.Column('created_at',    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
    )
    op.create_index('ix_users_login', 'users', ['login'])

    # user_roles
    op.create_table(
        'user_roles',
        sa.Column('id',      sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role',    sa.String(32), nullable=False),
    )
    op.create_index('ix_user_roles_user_id', 'user_roles', ['user_id'])

    # media_files
    op.create_table(
        'media_files',
        sa.Column('id',          sa.String(36),  primary_key=True),
        sa.Column('owner_id',    sa.String(36),  sa.ForeignKey('users.id'), nullable=False),
        sa.Column('filename',    sa.String(255), nullable=False),
        sa.Column('file_path',   sa.String(500), nullable=False),
        sa.Column('mime_type',   sa.String(100), nullable=False),
        sa.Column('size_bytes',  sa.Integer(),   nullable=False),
        sa.Column('media_type',  sa.String(10),  nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
    )

    # playlists
    op.create_table(
        'playlists',
        sa.Column('id',           sa.String(36),  primary_key=True),
        sa.Column('owner_id',     sa.String(36),  sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title',        sa.String(255), nullable=False, server_default='Плейлист'),
        sa.Column('loop_mode',    sa.Boolean(),   nullable=False, server_default='false'),
        sa.Column('shuffle_mode', sa.Boolean(),   nullable=False, server_default='false'),
        sa.Column('created_at',   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
    )

    # playlist_items
    op.create_table(
        'playlist_items',
        sa.Column('id',            sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('playlist_id',   sa.String(36), sa.ForeignKey('playlists.id',   ondelete='CASCADE')),
        sa.Column('media_file_id', sa.String(36), sa.ForeignKey('media_files.id', ondelete='CASCADE')),
        sa.Column('position',      sa.Integer(),  nullable=False, server_default='0'),
    )

    # messages
    op.create_table(
        'messages',
        sa.Column('id',         sa.String(36), primary_key=True),
        sa.Column('sender_id',  sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('content',    sa.Text(),     nullable=False, server_default=''),
        sa.Column('voice_path', sa.String(500), nullable=True),
        sa.Column('status',     sa.String(20), nullable=False, server_default='new'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
    )

    # stream_sessions
    op.create_table(
        'stream_sessions',
        sa.Column('id',                 sa.String(36), primary_key=True),
        sa.Column('host_id',            sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_active',          sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_video',           sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('current_track',      sa.String(255), nullable=True),
        sa.Column('active_playlist_id', sa.String(36),
                  sa.ForeignKey('playlists.id', ondelete='SET NULL'), nullable=True),
        sa.Column('peak_listeners',     sa.Integer(), nullable=False, server_default='0'),
        sa.Column('started_at',         sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('ended_at',           sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('stream_sessions')
    op.drop_table('messages')
    op.drop_table('playlist_items')
    op.drop_table('playlists')
    op.drop_table('media_files')
    op.drop_index('ix_user_roles_user_id', 'user_roles')
    op.drop_table('user_roles')
    op.drop_index('ix_users_login', 'users')
    op.drop_table('users')
