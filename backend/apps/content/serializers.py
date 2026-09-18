from rest_framework import serializers
from .models import Content


class ContentSerializer(serializers.ModelSerializer):
    body = serializers.CharField(max_length=50000)

    class Meta:
        model = Content
        fields = ["id", "title", "summary", "body", "status", "published_at", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "published_at", "created_at", "updated_at"]
