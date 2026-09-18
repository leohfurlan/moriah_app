from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, mixins, parsers, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsEventManager

from .models import Event, EventAnnouncement
from .serializers import ChurchEventSerializer, EventAnnouncementSerializer


class MyChurchEventsView(generics.ListAPIView):
    """Eventos ativos da igreja do usuario para a agenda pessoal."""

    serializer_class = ChurchEventSerializer
    permission_classes = [IsAuthenticated]
    queryset = Event.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Event.objects.none()
        return Event.objects.filter(
            church=self.request.user.church,
            active=True,
            start_at__gte=timezone.now() - timedelta(days=1),
        ).order_by("start_at")


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
