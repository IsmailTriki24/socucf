from django.contrib import admin
from django.urls import include, path

from django.conf import settings

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("clients.urls")),
    path("api/", include("audit.urls")),
]

if getattr(settings, "OIDC_RP_CLIENT_ID", ""):
    urlpatterns += [path("api/oidc/", include("mozilla_django_oidc.urls"))]
