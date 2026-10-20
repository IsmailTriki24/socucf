from django.urls import path

from . import views

urlpatterns = [
    path("clients/<int:client_id>/audit", views.client_audit),
    path("audit", views.global_audit),
]
