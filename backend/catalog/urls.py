from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=False)
router.register("domaines", views.DomaineViewSet, basename="domaine")
router.register("sources-log", views.SourceLogViewSet, basename="sourcelog")
router.register("siems", views.SiemViewSet, basename="siem")

urlpatterns = [
    path("", include(router.urls)),
    path("guide-traduction", views.guide_traduction),
    path("aide", views.aide),
    path("techniques", views.techniques),
    path("tactiques", views.tactiques),
    path("templates", views.templates),
    path("templates/<str:code>", views.template_detail),
    path("templates/<str:code>/dupliquer", views.template_dupliquer),
    path("templates/<str:code>/syntaxes/<slug:siem_code>", views.template_syntaxe),
    path("templates/<str:code>/hunting", views.template_hunting),
    path("hunting/<int:pk>", views.hunting_detail),
    path("catalogue/import", views.catalogue_import),
    path("catalogue/attack", views.attack_import),
    path("catalogue/attack/impacts", views.attack_impacts),
    path("catalogue/stats", views.catalogue_stats),
    path("catalogue/couverture", views.catalogue_couverture),
    path("catalogue/export.xlsx", views.catalogue_export),
]
