"""remove Gemini runs (the Gemini engine was removed)

Revision ID: f5b2c9d3a117
Revises: e3f8a6b1d204
Create Date: 2026-11-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f5b2c9d3a117'
down_revision: Union[str, Sequence[str], None] = 'e3f8a6b1d204'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GONE = "SELECT id FROM runs WHERE engine = 'gemini' AND (is_mock OR status != 'done')"


def upgrade() -> None:
    # deletes simulated and unfinished/failed Gemini runs; real finished Gemini answers, if any, are kept
    op.execute(f"DELETE FROM mentions WHERE run_id IN ({GONE})")
    op.execute(f"DELETE FROM citations WHERE run_id IN ({GONE})")
    op.execute("DELETE FROM runs WHERE engine = 'gemini' AND (is_mock OR status != 'done')")


def downgrade() -> None:
    pass  # deleted data cannot be restored
