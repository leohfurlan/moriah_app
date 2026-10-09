from rest_framework import serializers

from .permissions import can_manage_content
from .models import Content


class ContentSerializer(serializers.ModelSerializer):
    body = serializers.CharField(max_length=50000)
    author_name = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    def get_author_name(self, obj) -> str:
        if not obj.author:
            return ""
        return obj.author.get_full_name().strip() or obj.author.email

    def get_can_manage(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and can_manage_content(request.user))

    class Meta:
        model = Content
        fields = ("id", "title", "summary", "body", "status", "author_name", "can_manage", "published_at", "created_at", "updated_at")
        read_only_fields = ("status", "published_at", "created_at", "updated_at")
