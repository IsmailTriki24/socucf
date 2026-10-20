from django.urls import path

from . import views

urlpatterns = [
    path("clients", views.clients),
    path("clients/<int:client_id>", views.client_detail),
    path("clients/<int:client_id>/sources", views.client_sources),
    path("clients/<int:client_id>/sources/<int:source_id>/ajouter", views.client_source_ajouter),
    path("clients/<int:client_id>/detections", views.client_detections),
    path("clients/<int:client_id>/detections/groupe", views.client_detections_bulk),
    path("clients/<int:client_id>/bibliotheque", views.client_bibliotheque),
    path("clients/<int:client_id>/dashboard", views.client_dashboard),
    path("clients/<int:client_id>/couverture", views.client_couverture),
    path("clients/<int:client_id>/export.<str:fmt>", views.client_export),
    path("detections/<int:pk>", views.detection_detail),
    path("detections/<int:pk>/reinitialiser", views.detection_reinitialiser),
    path("detections/<int:pk>/syntaxes/<slug:siem_code>", views.detection_syntaxe),
    path("detections/<int:pk>/hunting", views.detection_hunting_create),
    path("detections/<int:pk>/hunting/<int:hid>", views.detection_hunting_detail),
    path("detections/<int:pk>/preuves", views.detection_preuve),
    path("preuves/<int:pk>", views.preuve_detail),
    path("preuves/<int:pk>/capture", views.preuve_capture),
]
