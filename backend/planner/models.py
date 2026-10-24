from django.db import models


class TripAnalysis(models.Model):
    """Persist a completed analysis so heatmap requests survive worker restarts."""

    trip_id = models.CharField(max_length=32, unique=True, db_index=True)
    payload = models.JSONField()
    heatmaps = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
