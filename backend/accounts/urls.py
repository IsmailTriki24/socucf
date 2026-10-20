from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf", views.csrf),
    path("auth/login", views.login_view),
    path("auth/logout", views.logout_view),
    path("auth/me", views.me),
    path("users", views.users),
    path("users/lookup", views.user_lookup),
    path("users/<int:pk>", views.user_detail),
    path("clients/<int:client_id>/habilitations", views.client_habilitations),
    path("habilitations/<int:pk>", views.habilitation_detail),
    path("acces", views.acces),
]
