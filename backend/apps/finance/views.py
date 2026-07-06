from rest_framework import generics, mixins, parsers, viewsets

from .models import Contribution
from .serializers import ContributionSerializer


class MyStatementView(generics.ListAPIView):
    serializer_class = ContributionSerializer

    def get_queryset(self):
        return Contribution.objects.filter(member=self.request.user.member_profile).prefetch_related("attachments")


class ContributionViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = ContributionSerializer
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_queryset(self):
        return Contribution.objects.filter(member=self.request.user.member_profile)

    def perform_create(self, serializer):
        serializer.save(
            church=self.request.user.church,
            member=self.request.user.member_profile,
            created_by=self.request.user,
        )
