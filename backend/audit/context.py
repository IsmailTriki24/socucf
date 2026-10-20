from contextvars import ContextVar

_current_request: ContextVar = ContextVar("audit_current_request", default=None)
_current_user: ContextVar = ContextVar("audit_current_user", default=None)


def set_request(request):
    return _current_request.set(request)


def reset_request(token):
    _current_request.reset(token)


def set_user(user):
    """Pour les commandes de gestion et les tests (hors requête HTTP)."""
    return _current_user.set(user)


def reset_user(token):
    _current_user.reset(token)


def current_user():
    request = _current_request.get()
    if request is not None:
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return user
    return _current_user.get()


_muted: ContextVar = ContextVar("audit_muted", default=False)


def mute():
    """Suspend l'écriture automatique du journal (suppression en cascade d'un client)."""
    return _muted.set(True)


def unmute(token):
    _muted.reset(token)


def is_muted() -> bool:
    return _muted.get()
