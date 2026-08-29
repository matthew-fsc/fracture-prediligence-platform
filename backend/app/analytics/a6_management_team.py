# Re-export shim — logic moved to operational_analytics.py
from app.analytics.operational_analytics import compute_management_team, ManagementTeamScore
__all__ = ["compute_management_team", "ManagementTeamScore"]
