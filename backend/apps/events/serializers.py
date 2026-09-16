from rest_framework import serializers

from .models import Event


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
