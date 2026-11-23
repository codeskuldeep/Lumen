"""remove demo Perplexity runs (the Perplexity engine was removed)

Revision ID: d7a1b3c5e902
Revises: c41d7e2a9b10
Create Date: 2026-11-18 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd7a1b3c5e902'
down_revision: Union[str, Sequence[str], None] = 'c41d7e2a9b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEMO = "SELECT id FROM runs WHERE engine = 'perplexity' AND (is_mock OR status != 'done')"


def upgrade() -> None:
    # deletes simulated (demo) answers and unfinished runs; real finished Perplexity answers, if any, are kept
    op.execute(f"DELETE FROM mentions WHERE run_id IN ({DEMO})")
    op.execute(f"DELETE FROM citations WHERE run_id IN ({DEMO})")
    op.execute("DELETE FROM runs WHERE engine = 'perplexity' AND (is_mock OR status != 'done')")


def downgrade() -> None:
    pass  # deleted demo data cannot be restored
