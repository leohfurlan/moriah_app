from django.contrib import admin


class ChurchScopedAdmin(admin.ModelAdmin):
    """Configuration links must not expose another church through Django Admin."""
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        field = "pk" if self.model._meta.label_lower == "accounts.church" else "church_id"
        return qs.filter(**{field: request.user.church_id}) if request.user.church_id else qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        model = db_field.remote_field.model
        if model._meta.label_lower == "accounts.church":
            kwargs["queryset"] = model.objects.filter(pk=request.user.church_id)
        elif any(field.name == "church" for field in model._meta.fields):
            kwargs["queryset"] = model.objects.filter(church_id=request.user.church_id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        if hasattr(obj, "church_id"):
            obj.church_id = request.user.church_id
        super().save_model(request, obj, form, change)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        model = db_field.remote_field.model
        if any(field.name == "church" for field in model._meta.fields):
            kwargs["queryset"] = model.objects.filter(church_id=request.user.church_id)
        return super().formfield_for_manytomany(db_field, request, **kwargs)

    def has_add_permission(self, request):
        return bool(request.user.church_id and self.model._meta.label_lower != "accounts.church" and super().has_add_permission(request))
