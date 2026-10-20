from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Convertit les erreurs métier Django en réponses JSON {detail, champs}."""
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            return Response({"detail": "Données invalides.", "champs": exc.message_dict}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(exc, PermissionError):
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    if isinstance(exc, ProtectedError):
        return Response({"detail": "Suppression impossible : l'objet est utilisé ailleurs."}, status=status.HTTP_409_CONFLICT)
    if isinstance(exc, IntegrityError):
        return Response({"detail": "Conflit : cet enregistrement existe déjà ou viole une contrainte."}, status=status.HTTP_409_CONFLICT)
    response = drf_exception_handler(exc, context)
    if response is not None and isinstance(response.data, (list, dict)) and "detail" not in response.data:
        response.data = {"detail": "Données invalides.", "champs": response.data}
    return response
