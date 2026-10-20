from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "audit"
    label = "audit"

    def ready(self):
        from . import signals

        # Objets non rattachés à un client
        for label in (
            "accounts.User",
            "catalog.Domaine",
            "catalog.SourceLog",
            "catalog.Siem",
            "catalog.GuideTraduction",
            "catalog.Template",
            "catalog.TemplateSource",
            "clients.Client",
        ):
            signals.register(label)
        # Objets rattachés à un client
        signals.register("clients.Client", lambda o: o.pk)
        signals.register("accounts.Habilitation", lambda o: o.client_id)
        signals.register("clients.ClientSource", lambda o: o.client_id)
        signals.register("clients.DetectionClient", lambda o: o.client_id)
        signals.register("clients.DetectionSource", lambda o: o.detection.client_id)
        signals.register("clients.PreuveTest", lambda o: o.detection.client_id)

        def syntaxe_client(o):
            return o.detection_client.client_id if o.detection_client_id else None

        signals.register("catalog.Syntaxe", syntaxe_client)
        signals.register("catalog.RequeteHunting", syntaxe_client)
        signals.connect()
