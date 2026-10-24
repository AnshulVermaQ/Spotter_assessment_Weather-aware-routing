from django.urls import path
from planner import views

urlpatterns = [
    path("api/health", views.health),
    path("api/geocode", views.geocode),
    path("api/routes/analyze", views.analyze_routes),
    path("api/heatmap", views.heatmap),
    path("api/pois", views.pois),
]
