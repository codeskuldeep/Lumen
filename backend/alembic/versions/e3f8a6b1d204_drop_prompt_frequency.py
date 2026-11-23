"""drop prompts.frequency (scans are manual now, nothing schedules prompts)

Revision ID: e3f8a6b1d204
Revises: d7a1b3c5e902
Create Date: 2026-11-18 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f8a6b1d204'
down_revision: Union[str, Sequence[str], None] = 'd7a1b3c5e902'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('prompts') as batch:
        batch.drop_column('frequency')


def downgrade() -> None:
    with op.batch_alter_table('prompts') as batch:
        batch.add_column(sa.Column('frequency', sa.String(length=10), nullable=False, server_default='weekly'))
