"""Add error message tracking

Revision ID: 8f84fad4e00b
Revises: 58933b5cc6e8
Create Date: 2022-11-15 01:38:28.531640

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8f84fad4e00b"
down_revision = "58933b5cc6e8"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "privacyrequesterror",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("message_sent", sa.Boolean(), nullable=False),
        sa.Column("privacy_request_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["privacy_request_id"],
            ["privacyrequest.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_privacyrequesterror_id"), "privacyrequesterror", ["id"], unique=False
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f("ix_privacyrequesterror_id"), table_name="privacyrequesterror")
    op.drop_table("privacyrequesterror")
    # ### end Alembic commands ###