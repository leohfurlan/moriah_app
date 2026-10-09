from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from apps.accounts.pagination import OptionalPaginationMixin
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog

from .models import Content
from .permissions import CanAccessContent, can_manage_content
from .serializers import ContentSerializer


class ContentViewSet(
    OptionalPaginationMixin,
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

    def audit(self, content, action_name):
        AuditLog.objects.create(church=content.church, user=self.request.user,
                                action=action_name, model_name="Content",
                                object_id=str(content.pk), payload={"status": content.status})

    def get_object(self):
        if self.action in ("update", "partial_update", "destroy", "publish", "unpublish"):
            obj = get_object_or_404(self.get_queryset().select_for_update(), pk=self.kwargs["pk"])
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        if not can_manage_content(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Somente a lideranÃ§a pode criar conteÃºdo.")
        content = serializer.save(church=self.request.user.church, author=self.request.user)
        self.audit(content, "content_created")

    def perform_update(self, serializer):
        if not can_manage_content(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Somente a lideranÃ§a pode editar conteÃºdo.")
        content = serializer.save()
        self.audit(content, "content_updated")

    def perform_destroy(self, instance):
        if not can_manage_content(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Somente a lideranÃ§a pode excluir conteÃºdo.")
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
            return Response({"detail": "Sem permissÃ£o para publicar."}, status=status.HTTP_403_FORBIDDEN)
        content = self.get_object()
        if content.status == Content.Status.PUBLISHED:
            return Response(self.get_serializer(content).data)
        content.status = Content.Status.PUBLISHED
        content.published_at = timezone.now()
        content.save(update_fields=("status", "published_at", "updated_at"))
        AuditLog.objects.create(church=content.church, user=request.user, action="content_published", model_name="Content", object_id=str(content.id), payload={"title": content.title})
        return Response(self.get_serializer(content).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def unpublish(self, request, pk=None):
        if not can_manage_content(request.user):
            return Response({"detail": "Sem permissÃ£o para retirar conteÃºdo."}, status=status.HTTP_403_FORBIDDEN)
        content = self.get_object()
        if content.status == Content.Status.DRAFT:
            return Response(self.get_serializer(content).data)
        content.status = Content.Status.DRAFT
        content.published_at = None
        content.save(update_fields=("status", "published_at", "updated_at"))
        AuditLog.objects.create(church=content.church, user=request.user, action="content_unpublished", model_name="Content", object_id=str(content.id), payload={"title": content.title})
        return Response(self.get_serializer(content).data)
