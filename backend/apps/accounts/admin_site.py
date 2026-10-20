from django.contrib.admin import AdminSite
from django.contrib.admin.forms import AdminAuthenticationForm
from django.core.exceptions import ValidationError
from django import forms
from django.conf import settings
from rest_framework.exceptions import Throttled
from .sessions import active, client_ip, reserve_attempt, create_session, session_valid
from .models import AuthSession
from .mfa import verify_admin


OWNER_EMAIL = "admin@igrejamoriah.com"


def is_panel_owner(user):
    return bool(user.is_authenticated and active(user) and user.is_staff
                and user.email.casefold() == OWNER_EMAIL)


class OwnerAuthenticationForm(AdminAuthenticationForm):
    mfa_code = forms.CharField(label="Código do autenticador ou recuperação", required=False)

    def clean(self):
        try:
            reserve_attempt(str(self.cleaned_data.get("username", "")), client_ip(self.request))
        except Throttled:
            raise ValidationError("Muitas tentativas. Aguarde 15 minutos.") from None
        return super().clean()

    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if not is_panel_owner(user):
            raise ValidationError("Acesso restrito ao administrador responsável.", code="invalid_login")
        if settings.MFA_REQUIRED:
            if not verify_admin(user, self.cleaned_data.get("mfa_code", "")):
                raise ValidationError("Código inválido. Configure o autenticador pelo aplicativo Moriah.", code="invalid_login")
            self.request.session["moriah_mfa_verified"] = True
        self.request.session["moriah_auth_sid"] = str(create_session(user, mfa_verified=settings.MFA_REQUIRED).pk)


class OwnerAdminSite(AdminSite):
    login_form = OwnerAuthenticationForm
    login_template = "accounts/admin_login.html"

    def has_permission(self, request):
        if not is_panel_owner(request.user):
            return False
        if not settings.MFA_REQUIRED:  # Test settings only; no production env bypass.
            return True
        session = AuthSession.objects.filter(pk=request.session.get("moriah_auth_sid"), user=request.user).first()
        return bool(session and session_valid(session) and session.mfa_verified)
