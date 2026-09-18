from rest_framework import serializers

from .models import Event, EventAnnouncement
from .validators import validate_event_announcement_image


class ChurchEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)

    class Meta:
        model = Event
        fields = (
            "id",
            "name",
            "event_type",
            "event_type_display",
            "start_at",
            "end_at",
            "location",
            "description",
        )


class EventAnnouncementSerializer(serializers.ModelSerializer):
    event_name = serializers.CharField(source="event.name", read_only=True)
    event_start_at = serializers.DateTimeField(source="event.start_at", read_only=True)
    event_location = serializers.CharField(source="event.location", read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = EventAnnouncement
        fields = (
            "id", "event", "event_name", "event_start_at", "event_location",
            "title", "image", "image_url", "position", "active", "created_at", "updated_at",
        )
        extra_kwargs = {"image": {"write_only": True, "required": False}}
        read_only_fields = ("created_at", "updated_at")

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        request = self.context.get("request")
        church = getattr(getattr(request, "user", None), "church", None)
        event = attrs.get("event", getattr(self.instance, "event", None))
        image = attrs.get("image")
        position = attrs.get("position", getattr(self.instance, "position", 1))
        active = attrs.get("active", getattr(self.instance, "active", True))
        if position not in range(1, 5):
            raise serializers.ValidationError({"position": "A posição deve estar entre 1 e 4."})
        if event and church and event.church_id != church.id:
            raise serializers.ValidationError({"event": "Selecione um evento da sua igreja."})
        if image:
            validate_event_announcement_image(image)
        if active and church:
            queryset = EventAnnouncement.objects.filter(church=church, active=True, position=position)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError({"position": "Esta posição já está ocupada no carrossel."})
        return attrs
