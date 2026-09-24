from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog

from .models import Content
from .permissions import CanAccessContent, can_manage_content
from .serializers import ContentSerializer


class ContentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ContentSerializer
    permission_classes = [IsAuthenticated, CanAccessContent]
    queryset = Content.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Content.objects.none()
        queryset = Content.objects.filter(church=self.request.user.church)
        if not can_manage_content(self.request.user):
            queryset = queryset.filter(status=Content.Status.PUBLISHED)
        return queryset

    def perform_create(self, serializer):
        if not can_manage_content(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Somente a liderança pode criar conteúdo.")
        serializer.save(church=self.request.user.church, author=self.request.user)

    def perform_update(self, serializer):
        if not can_manage_content(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Somente a liderança pode editar conteúdo.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_content(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Somente a liderança pode excluir conteúdo.")
        AuditLog.objects.create(
            church=instance.church,
            user=self.request.user,
            action="content_deleted",
            model_name="Content",
            object_id=str(instance.id),
            payload={"title": instance.title, "status": instance.status},
        )
        instance.delete()

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def publish(self, request, pk=None):
        if not can_manage_content(request.user):
            return Response({"detail": "Sem permissão para publicar."}, status=status.HTTP_403_FORBIDDEN)
        content = self.get_object()
        content.status = Content.Status.PUBLISHED
        content.published_at = timezone.now()
        content.save(update_fields=("status", "published_at", "updated_at"))
        AuditLog.objects.create(church=content.church, user=request.user, action="content_published", model_name="Content", object_id=str(content.id), payload={"title": content.title})
        return Response(self.get_serializer(content).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def unpublish(self, request, pk=None):
        if not can_manage_content(request.user):
            return Response({"detail": "Sem permissão para retirar conteúdo."}, status=status.HTTP_403_FORBIDDEN)
        content = self.get_object()
        content.status = Content.Status.DRAFT
        content.published_at = None
        content.save(update_fields=("status", "published_at", "updated_at"))
        AuditLog.objects.create(church=content.church, user=request.user, action="content_unpublished", model_name="Content", object_id=str(content.id), payload={"title": content.title})
        return Response(self.get_serializer(content).data)
