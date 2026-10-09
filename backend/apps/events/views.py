from datetime import date, timedelta

from django.utils import timezone
from rest_framework import generics, mixins, parsers, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from apps.accounts.pagination import OptionalPaginationMixin
from apps.accounts.permissions import IsEventManager

from .models import Event, EventAnnouncement
from .serializers import ChurchEventSerializer, EventAnnouncementSerializer


class MyChurchEventsView(OptionalPaginationMixin, generics.ListAPIView):
    """Eventos ativos da igreja do usuario para a agenda pessoal."""

    serializer_class = ChurchEventSerializer
    permission_classes = [IsAuthenticated]
    queryset = Event.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Event.objects.none()
        queryset = Event.objects.filter(
            church=self.request.user.church,
            active=True,
            start_at__gte=timezone.now() - timedelta(days=1),
        )
        event_type = self.request.query_params.get("event_type")
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(name__icontains=search)
        for name, lookup in (("date_from", "start_at__date__gte"), ("date_to", "start_at__date__lte")):
            value = self.request.query_params.get(name)
            if value:
                try:
                    date.fromisoformat(value)
                except ValueError as exc:
                    raise ValidationError({name: "Use a data no formato AAAA-MM-DD."}) from exc
                queryset = queryset.filter(**{lookup: value})
        return queryset.order_by("start_at")


class EventAnnouncementViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = EventAnnouncementSerializer
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    queryset = EventAnnouncement.objects.none()

    def get_permissions(self):
        if getattr(self, "action", None) == "list":
            return [IsAuthenticated()]
        return [IsEventManager()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return EventAnnouncement.objects.none()
        queryset = EventAnnouncement.objects.filter(church=self.request.user.church).select_related("event")
        if not IsEventManager().has_permission(self.request, self):
            queryset = queryset.filter(active=True)
        return queryset

    def perform_create(self, serializer):
        serializer.save(church=self.request.user.church, created_by=self.request.user)
