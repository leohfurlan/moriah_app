from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    label = "accounts"

    def ready(self):
        from . import onboarding_signals  # noqa: F401
        from . import security_signals  # noqa: F401
        from . import schema  # noqa: F401
        from django.conf import settings
        if settings.MFA_REQUIRED and not settings.DEBUG:
            from .mfa import cipher
            from django.core.exceptions import ImproperlyConfigured
            try:
                cipher()
            except (ValueError, TypeError):
                raise ImproperlyConfigured("MFA_ENCRYPTION_KEY deve ser uma chave Fernet separada.") from None
