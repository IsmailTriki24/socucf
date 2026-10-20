from rest_framework.authentication import SessionAuthentication


class SessionAuthentication401(SessionAuthentication):
    """Session Django ; répond 401 (et non 403) quand l'utilisateur n'est pas connecté."""

    def authenticate_header(self, request):
        return "Session"
