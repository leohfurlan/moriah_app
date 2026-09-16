from datetime import timedelta

from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Event
from .serializers import ChurchEventSerializer


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
