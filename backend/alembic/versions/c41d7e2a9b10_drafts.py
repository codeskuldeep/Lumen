"""drafts

Revision ID: c41d7e2a9b10
Revises: 9b855ad15f26
Create Date: 2026-11-18 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c41d7e2a9b10'
down_revision: Union[str, Sequence[str], None] = '9b855ad15f26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('drafts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('agency_id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('action_id', sa.String(length=300), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('model', sa.String(length=80), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['agency_id'], ['agencies.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_drafts_agency_id'), 'drafts', ['agency_id'], unique=False)
    op.create_index(op.f('ix_drafts_client_id'), 'drafts', ['client_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_drafts_client_id'), table_name='drafts')
    op.drop_index(op.f('ix_drafts_agency_id'), table_name='drafts')
    op.drop_table('drafts')
