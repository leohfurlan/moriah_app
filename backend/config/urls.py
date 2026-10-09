from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from config.health import liveness, readiness
from config.private_media import PrivateMediaView
from apps.accounts.views import MeView
from apps.accounts.onboarding_views import (PersonalOnboardingView, CompleteOnboardingView,
    ChurchSetupView, ConfirmSetupView, DismissSetupView, ServiceTimeViewSet)
from apps.accounts.whatsapp_views import (WhatsAppConfigView, WhatsAppRequestView, WhatsAppVerifyView,
    WhatsAppRegisterView, WhatsAppLinkRequestView, WhatsAppLinkVerifyView)
from apps.events.views import EventAnnouncementViewSet, MyChurchEventsView
from apps.cells.views import CellMeetingViewSet, LeaderCellMembersView
from apps.audit.notification_views import MyNotificationViewSet
from apps.content.views import ContentViewSet
from apps.finance.views import ContributionViewSet, FinancialEntryViewSet, MyStatementView
from apps.members.views import MemberLinkReviewViewSet, MemberDirectoryViewSet, MyMemberLinkRequestView, MyMemberUpdateRequestViewSet, MyMemberView
from apps.ministries.views import MinistryListView
from apps.schedules.views import (
    MyScheduleAssignmentDetailView,
    MyScheduleAssignmentsView,
    PersonalCommitmentViewSet,
    ScheduleAssignmentActionView,
    ScheduleAssignmentCreateView,
    ScheduleAssignmentDeleteView,
    ScheduleCancelView,
    ScheduleCandidatesView,
    ScheduleDetailView,
    ScheduleListCreateView,
    SchedulePublishView,
    ScheduleSubstitutionView,
)


router = DefaultRouter()
router.register("church/service-times", ServiceTimeViewSet, basename="service-times")
router.register("member-link-requests", MemberLinkReviewViewSet, basename="member-link-review")
router.register("contributions", ContributionViewSet, basename="contribution")
router.register("finance/entries", FinancialEntryViewSet, basename="financial-entry")
router.register("content", ContentViewSet, basename="content")
router.register("members", MemberDirectoryViewSet, basename="member-directory")
router.register("event-announcements", EventAnnouncementViewSet, basename="event-announcement")
router.register("cell-meetings", CellMeetingViewSet, basename="cell-meeting")
router.register("me/member-requests", MyMemberUpdateRequestViewSet, basename="member-update-request")
router.register("me/agenda", PersonalCommitmentViewSet, basename="personal-commitment")
router.register("me/notifications", MyNotificationViewSet, basename="notification")

onboarding_patterns = [
    path("me/onboarding/", PersonalOnboardingView.as_view()),
    path("me/onboarding/complete/", CompleteOnboardingView.as_view()),
    path("church/setup/", ChurchSetupView.as_view()),
    path("church/setup/confirm/", ConfirmSetupView.as_view()),
    path("church/setup/dismiss/", DismissSetupView.as_view()),
]

whatsapp_patterns = [
    path("config/", WhatsAppConfigView.as_view()),
    path("request/", WhatsAppRequestView.as_view()),
    path("verify/", WhatsAppVerifyView.as_view()),
    path("register/", WhatsAppRegisterView.as_view()),
    path("link/request/", WhatsAppLinkRequestView.as_view()),
    path("link/verify/", WhatsAppLinkVerifyView.as_view()),
]

urlpatterns = [
    path("api/", include(onboarding_patterns)),
    path("api/auth/whatsapp/", include(whatsapp_patterns)),
    # Saude (publico, sem detalhe interno): usado pelo healthcheck do compose.
    path("health/", liveness, name="health"),
    path("health/ready/", readiness, name="health-ready"),
    path("admin/", admin.site.urls),
    path("api/files/<str:kind>/<int:pk>/", PrivateMediaView.as_view(), name="private-media"),
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/me/", MeView.as_view(), name="me"),
    path("api/me/member/", MyMemberView.as_view(), name="my-member"),
    path("api/me/member-link-requests/", MyMemberLinkRequestView.as_view(), name="my-member-link-requests"),
    path("api/me/statement/", MyStatementView.as_view(), name="my-statement"),
    path("api/me/events/", MyChurchEventsView.as_view(), name="my-events"),
    path("api/me/schedules/", MyScheduleAssignmentsView.as_view(), name="my-schedules"),
    path("api/me/schedules/<int:pk>/", MyScheduleAssignmentDetailView.as_view(), name="my-schedule-detail"),
    path("api/me/schedules/<int:pk>/action/", ScheduleAssignmentActionView.as_view(), name="schedule-action"),
    path("api/schedules/", ScheduleListCreateView.as_view(), name="schedule-create"),
    path("api/schedules/<int:pk>/", ScheduleDetailView.as_view(), name="schedule-detail"),
    path("api/schedules/<int:pk>/publish/", SchedulePublishView.as_view(), name="schedule-publish"),
    path("api/schedules/<int:pk>/cancel/", ScheduleCancelView.as_view(), name="schedule-cancel"),
    path("api/schedules/<int:pk>/candidates/", ScheduleCandidatesView.as_view(), name="schedule-candidates"),
    path(
        "api/schedules/<int:pk>/assignments/",
        ScheduleAssignmentCreateView.as_view(),
        name="schedule-assignment-create",
    ),
    path(
        "api/schedules/<int:schedule_pk>/assignments/<int:assignment_pk>/",
        ScheduleAssignmentDeleteView.as_view(),
        name="schedule-assignment-delete",
    ),
    path("api/schedules/<int:schedule_pk>/assignments/<int:assignment_pk>/substitute/",
        ScheduleSubstitutionView.as_view(),
        name="schedule-substitute",
    ),
    path("api/ministries/", MinistryListView.as_view(), name="ministry-list"),
    path("api/leader/cell-members/", LeaderCellMembersView.as_view(), name="leader-cell-members"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/", include(router.urls)),
]
if not settings.PRIVATE_LOCAL_MEDIA:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Aliases para desenvolvimento local. Algumas extensoes de bloqueio do navegador
# interpretam caminhos com `api` como rastreamento e impedem o fetch do Expo.
# Mantemos `/api/` como contrato publico e oferecemos caminhos equivalentes
# para que o cliente web local consiga falar com o mesmo backend.
local_api_urlpatterns = [
    path("", include(onboarding_patterns)),
    path("auth/whatsapp/", include(whatsapp_patterns)),
    path("auth/login/", TokenObtainPairView.as_view(), name="local-token-obtain-pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="local-token-refresh"),
    path("me/", MeView.as_view(), name="local-me"),
    path("me/member/", MyMemberView.as_view(), name="local-my-member"),
    path("me/member-link-requests/", MyMemberLinkRequestView.as_view(), name="local-my-member-link-requests"),
    path("me/statement/", MyStatementView.as_view(), name="local-my-statement"),
    path("me/events/", MyChurchEventsView.as_view(), name="local-my-events"),
    path("me/schedules/", MyScheduleAssignmentsView.as_view(), name="local-my-schedules"),
    path("me/schedules/<int:pk>/", MyScheduleAssignmentDetailView.as_view(), name="local-my-schedule-detail"),
    path("me/schedules/<int:pk>/action/", ScheduleAssignmentActionView.as_view(), name="local-schedule-action"),
    path("schedules/", ScheduleListCreateView.as_view(), name="local-schedule-create"),
    path("schedules/<int:pk>/", ScheduleDetailView.as_view(), name="local-schedule-detail"),
    path("schedules/<int:pk>/publish/", SchedulePublishView.as_view(), name="local-schedule-publish"),
    path("schedules/<int:pk>/cancel/", ScheduleCancelView.as_view(), name="local-schedule-cancel"),
    path("schedules/<int:pk>/candidates/", ScheduleCandidatesView.as_view(), name="local-schedule-candidates"),
    path("schedules/<int:pk>/assignments/", ScheduleAssignmentCreateView.as_view(), name="local-schedule-assignment-create"),
    path("schedules/<int:schedule_pk>/assignments/<int:assignment_pk>/", ScheduleAssignmentDeleteView.as_view(), name="local-schedule-assignment-delete"),
    path("schedules/<int:schedule_pk>/assignments/<int:assignment_pk>/substitute/", ScheduleSubstitutionView.as_view(), name="local-schedule-substitute"),
    path("ministries/", MinistryListView.as_view(), name="local-ministry-list"),
    path("leader/cell-members/", LeaderCellMembersView.as_view(), name="local-leader-cell-members"),
    path("", include(router.urls)),
]

urlpatterns += [
    path("local-api/", include(local_api_urlpatterns)),
    path("backend/", include(local_api_urlpatterns)),
]
