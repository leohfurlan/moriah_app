from rest_framework import serializers

from .models import Content


class ContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Content
        fields = ("id", "title", "summary", "body", "status", "published_at", "created_at", "updated_at")
        read_only_fields = ("status", "published_at", "created_at", "updated_at")
