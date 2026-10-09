from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from apps.cells.models import Cell
from apps.events.models import Event, ServiceTime
from apps.ministries.models import Ministry
from .onboarding import invalidate_dismissals


@receiver(post_save, sender=ServiceTime)
@receiver(post_delete, sender=ServiceTime)
@receiver(post_save, sender=Event)
@receiver(post_delete, sender=Event)
@receiver(post_save, sender=Cell)
@receiver(post_delete, sender=Cell)
@receiver(post_save, sender=Ministry)
@receiver(post_delete, sender=Ministry)
def configuration_changed(sender, instance, **kwargs):
    if not kwargs.get("raw", False):
        invalidate_dismissals(instance.church_id)
