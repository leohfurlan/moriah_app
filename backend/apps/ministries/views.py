from rest_framework import generics

from apps.accounts.permissions import IsScheduleCoordinatorOrAdmin

from .models import Ministry
from .serializers import MinistrySerializer
from .services import managed_ministries


class MinistryListView(generics.ListAPIView):
    """Ministerios disponiveis para montar escala com esta conta.

    Lideranca recebe todos os ministerios da igreja; coordenador recebe apenas
    os que coordena, para a tela de criacao nunca oferecer escopo proibido.
    """

    serializer_class = MinistrySerializer
    permission_classes = [IsScheduleCoordinatorOrAdmin]
    queryset = Ministry.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Ministry.objects.none()
        return (
            managed_ministries(self.request.user)
            .prefetch_related("roles", "coordinators")
            .order_by("name")
        )
