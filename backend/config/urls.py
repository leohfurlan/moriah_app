from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.views import MeView
from apps.events.views import MyChurchEventsView
from apps.cells.views import CellMeetingViewSet, LeaderCellMembersView
from apps.finance.views import ContributionViewSet, MyStatementView
from apps.members.views import MyMemberUpdateRequestViewSet, MyMemberView
from apps.schedules.views import (
    MyScheduleAssignmentDetailView,
    MyScheduleAssignmentsView,
    PersonalCommitmentViewSet,
    ScheduleAssignmentActionView,
    ScheduleCreateView,
    SchedulePublishView,
    ScheduleSubstitutionView,
)


router = DefaultRouter()
router.register("contributions", ContributionViewSet, basename="contribution")
router.register("cell-meetings", CellMeetingViewSet, basename="cell-meeting")
router.register("me/member-requests", MyMemberUpdateRequestViewSet, basename="member-update-request")
router.register("me/agenda", PersonalCommitmentViewSet, basename="personal-commitment")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/me/", MeView.as_view(), name="me"),
    path("api/me/member/", MyMemberView.as_view(), name="my-member"),
    path("api/me/statement/", MyStatementView.as_view(), name="my-statement"),
    path("api/me/events/", MyChurchEventsView.as_view(), name="my-events"),
    path("api/me/schedules/", MyScheduleAssignmentsView.as_view(), name="my-schedules"),
    path("api/me/schedules/<int:pk>/", MyScheduleAssignmentDetailView.as_view(), name="my-schedule-detail"),
    path("api/me/schedules/<int:pk>/action/", ScheduleAssignmentActionView.as_view(), name="schedule-action"),
    path("api/schedules/", ScheduleCreateView.as_view(), name="schedule-create"),
    path("api/schedules/<int:pk>/publish/", SchedulePublishView.as_view(), name="schedule-publish"),
    path(
        "api/schedules/<int:schedule_pk>/assignments/<int:assignment_pk>/substitute/",
        ScheduleSubstitutionView.as_view(),
        name="schedule-substitute",
    ),
    path("api/leader/cell-members/", LeaderCellMembersView.as_view(), name="leader-cell-members"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/", include(router.urls)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)