from django.utils import timezone

from .models import Notification


def create_notification(*, user, church, category, title, body, detail="", action_label="", action_route="", dedupe_key):
    if user is None or not user.is_active or church is None:
        return None
    notification, _created = Notification.objects.get_or_create(
        dedupe_key=dedupe_key,
        defaults={
            "church": church,
            "recipient": user,
            "category": category,
            "title": title,
            "body": body,
            "detail": detail,
            "action_label": action_label,
            "action_route": action_route,
        },
    )
    return notification


def mark_notification_read(notification):
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=("read_at", "updated_at"))
