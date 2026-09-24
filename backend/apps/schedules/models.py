from django.conf import settings
from django.db import models

from apps.accounts.models import Church, TimestampedModel


class Schedule(TimestampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Rascunho"
        PUBLISHED = "published", "Publicada"
        CANCELLED = "cancelled", "Cancelada"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="schedules")
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="schedules")
    ministry = models.ForeignKey(
        "ministries.Ministry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedules",
        help_text="Ministerio responsavel pela escala. Coordenador so administra o do seu ministerio.",
    )
    name = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PUBLISHED)
    worship_team = models.ForeignKey(
        "schedules.WorshipTeam",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedules",
    )
    arrival_at = models.DateTimeField(null=True, blank=True)
    rehearsal_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_schedules")

    class Meta:
        verbose_name = "Escala"
        verbose_name_plural = "Escalas"

    def __str__(self) -> str:
        return f"{self.event} - {self.name}"


class ScheduleAssignment(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        CONFIRMED = "confirmed", "Confirmado"
        DECLINED = "declined", "Recusado"
        UNAVAILABLE = "unavailable", "Indisponivel"
        CONFLICT = "conflict", "Conflito de horario"
        REPLACEMENT_NEEDED = "replacement_needed", "Substituicao necessaria"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="schedule_assignments")
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name="assignments")
    member = models.ForeignKey("members.Member", on_delete=models.CASCADE, related_name="schedule_assignments")
    ministry_role = models.ForeignKey("ministries.MinistryRole", on_delete=models.PROTECT, related_name="schedule_assignments")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    justification = models.TextField(blank=True)
    conflict_reason = models.TextField(blank=True)
    substitution_for = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="substitutions")
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Escalado"
        verbose_name_plural = "Escalados"
        unique_together = ("schedule", "member", "ministry_role")

    def __str__(self) -> str:
        return f"{self.member} - {self.schedule}"


class ScheduleItem(TimestampedModel):
    """Item do repertorio / ordem do culto de uma escala."""

    class ItemType(models.TextChoices):
        SONG = "song", "Musica"
        MOMENT = "moment", "Momento"
        READING = "reading", "Leitura"
        OTHER = "other", "Outro"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="schedule_items")
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name="items")
    song = models.ForeignKey(
        "schedules.Song",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedule_items",
    )
    order = models.PositiveIntegerField(default=1, help_text="Posicao na ordem do culto.")
    item_type = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.SONG)
    title = models.CharField(max_length=255)
    song_key = models.CharField("Tom", max_length=12, blank=True, help_text="Ex: G, Am, D#")
    bpm = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    reference_url = models.URLField("Link", blank=True, help_text="Cifra, letra ou video de referencia.")
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Item da Escala"
        verbose_name_plural = "Itens da Escala"
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"{self.order}. {self.title}"


class PersonalCommitment(TimestampedModel):
    class CommitmentType(models.TextChoices):
        PERSONAL = "personal", "Pessoal"
        MINISTRY = "ministry", "Ministerial"
        CELL = "cell", "Celula"
        MEETING = "meeting", "Reuniao"
        OTHER = "other", "Outro"

    class Status(models.TextChoices):
        PLANNED = "planned", "Planejado"
        CANCELLED = "cancelled", "Cancelado"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="personal_commitments")
    member = models.ForeignKey("members.Member", on_delete=models.CASCADE, related_name="personal_commitments")
    title = models.CharField(max_length=255)
    commitment_type = models.CharField(max_length=20, choices=CommitmentType.choices, default=CommitmentType.PERSONAL)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Compromisso pessoal"
        verbose_name_plural = "Compromissos pessoais"
        ordering = ["starts_at"]

    def __str__(self) -> str:
        return f"{self.title} - {self.starts_at:%d/%m/%Y %H:%M}"

class WorshipTeam(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="worship_teams")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    members = models.ManyToManyField("members.Member", through="WorshipTeamMember", related_name="worship_teams", blank=True)

    class Meta:
        verbose_name = "Equipe de Louvor"
        verbose_name_plural = "Equipes de Louvor"
        unique_together = ("church", "name")

    def __str__(self) -> str:
        return self.name


class WorshipTeamMember(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="worship_team_members")
    team = models.ForeignKey(WorshipTeam, on_delete=models.CASCADE, related_name="team_members")
    member = models.ForeignKey("members.Member", on_delete=models.CASCADE, related_name="worship_team_memberships")
    role = models.CharField(max_length=120)
    active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Integrante da Equipe de Louvor"
        verbose_name_plural = "Integrantes das Equipes de Louvor"
        unique_together = ("team", "member", "role")

    def __str__(self) -> str:
        return f"{self.team} - {self.member} - {self.role}"


class Song(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="songs")
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255, blank=True)
    default_key = models.CharField(max_length=12, blank=True)
    bpm = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    tags = models.CharField(max_length=255, blank=True)
    spotify_url = models.URLField(blank=True)
    youtube_url = models.URLField(blank=True)
    chord_url = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Musica do Repertorio"
        verbose_name_plural = "Musicas do Repertorio"
        ordering = ["title"]
        unique_together = ("church", "title", "artist")

    def __str__(self) -> str:
        return f"{self.title} - {self.artist}" if self.artist else self.title