from django.contrib import admin

from .models import Content


@admin.register(Content)
class ContentAdmin(admin.ModelAdmin):
    list_display = ("title", "church", "status", "published_at", "author")
    list_filter = ("status", "church")
    search_fields = ("title", "summary", "body")
    autocomplete_fields = ("church", "author")
