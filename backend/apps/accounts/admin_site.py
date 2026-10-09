from django.contrib.admin import AdminSite
from django.contrib.admin.forms import AdminAuthenticationForm
from django.core.exceptions import ValidationError


OWNER_EMAIL = "admin@igrejamoriah.com"


def is_panel_owner(user):
    return bool(user.is_authenticated and user.is_active and user.is_staff
                and user.email.casefold() == OWNER_EMAIL)


class OwnerAuthenticationForm(AdminAuthenticationForm):
    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if not is_panel_owner(user):
            raise ValidationError("Acesso restrito ao administrador responsável.", code="invalid_login")


class OwnerAdminSite(AdminSite):
    login_form = OwnerAuthenticationForm

    def has_permission(self, request):
        return is_panel_owner(request.user)
