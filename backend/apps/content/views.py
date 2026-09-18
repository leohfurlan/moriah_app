from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from apps.audit.models import AuditLog
from apps.accounts.pagination import OptionalPaginationMixin
from .models import Content
from .permissions import CanAccessContent, can_manage_content
from .serializers import ContentSerializer


class ContentViewSet(OptionalPaginationMixin, viewsets.GenericViewSet):
    serializer_class = ContentSerializer
    permission_classes = [IsAuthenticated, CanAccessContent]
    queryset = Content.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Content.objects.none()
        queryset = Content.objects.filter(church_id=self.request.user.church_id)
        if not can_manage_content(self.request.user):
            queryset = queryset.filter(status=Content.Status.PUBLISHED)
        return queryset

    def audit(self, obj, action_name):
        AuditLog.objects.create(church=obj.church, user=self.request.user, action=action_name,
                                model_name="Content", object_id=str(obj.pk), payload={"status": obj.status})

    def list(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(queryset, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(self.get_serializer(self.get_object()).data)

    @transaction.atomic
    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(church=request.user.church, author=request.user)
        self.audit(obj, "content_created")
        return Response(serializer.data, status=201)

    @transaction.atomic
    def partial_update(self, request, pk=None):
        obj = self.get_object()
        if obj.status != Content.Status.DRAFT:
            return Response({"detail": "Retire o conteúdo do ar antes de editar."}, status=409)
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        self.audit(obj, "content_updated")
        return Response(serializer.data)

    def get_object(self):
        if self.action in ("partial_update", "publish", "unpublish"):
            obj = get_object_or_404(self.get_queryset().select_for_update(), pk=self.kwargs["pk"])
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    def change_publication(self, published):
        obj = self.get_object()
        target = Content.Status.PUBLISHED if published else Content.Status.DRAFT
        if obj.status != target:
            obj.status = target
            obj.published_at = timezone.now() if published else None
            obj.save(update_fields=["status", "published_at", "updated_at"])
            self.audit(obj, "content_published" if published else "content_unpublished")
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def publish(self, request, pk=None):
        return self.change_publication(True)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def unpublish(self, request, pk=None):
        return self.change_publication(False)
