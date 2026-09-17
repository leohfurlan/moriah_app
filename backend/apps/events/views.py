from datetime import date, timedelta

from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from .models import Event
from .serializers import ChurchEventSerializer
from apps.accounts.pagination import OptionalPaginationMixin


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
