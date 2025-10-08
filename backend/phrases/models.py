from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Expression(TimeStampedModel):
    TYPE_CHOICES = [
        ("phrase", "Phrase"),
        ("word", "Word"),
        ("idiom", "Idiom"),
        ("sentence", "Sentence"),
    ]

    type = models.CharField(max_length=32, choices=TYPE_CHOICES, default="phrase")
    text = models.TextField()
    meaning = models.TextField(blank=True)
    phonetic = models.CharField(max_length=255, blank=True)
    image_key = models.CharField(max_length=255, blank=True)
    audio_key = models.CharField(max_length=255, blank=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        indexes = [
            models.Index(fields=["type"]),
        ]

    def __str__(self) -> str:
        return f"{self.type}:{self.text[:32]}"


class Phrase(TimeStampedModel):
    TOPIC_CHOICES = [
        ("business", "Business"),
        ("travel", "Travel"),
        ("daily", "Daily"),
    ]

    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("normal", "Normal"),
        ("hard", "Hard"),
    ]

    text = models.TextField()
    meaning = models.TextField(blank=True)
    topic = models.CharField(max_length=64, choices=TOPIC_CHOICES, default="daily")
    tags = models.JSONField(default=list, blank=True)
    audio_key = models.CharField(max_length=255, blank=True)
    video_key = models.CharField(max_length=255, blank=True)
    scene_image_key = models.CharField(max_length=255, blank=True)
    duration_sec = models.PositiveIntegerField(default=0)
    difficulty = models.CharField(max_length=16, choices=DIFFICULTY_CHOICES, default="normal")
    expressions = models.ManyToManyField(Expression, through="PhraseExpression", related_name="phrases")

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["topic"]),
            models.Index(fields=["difficulty"]),
        ]

    def __str__(self) -> str:
        return self.text[:48]


class PhraseExpression(models.Model):
    phrase = models.ForeignKey(Phrase, on_delete=models.CASCADE)
    expression = models.ForeignKey(Expression, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("phrase", "expression")

    def __str__(self) -> str:
        return f"{self.phrase_id}:{self.expression_id}"


class UserSetting(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="setting")
    playback_speed = models.DecimalField(max_digits=3, decimal_places=2, default=1.0)
    volume = models.DecimalField(max_digits=3, decimal_places=2, default=0.8)
    show_japanese = models.BooleanField(default=True)
    repeat_count = models.PositiveIntegerField(default=1, help_text="Number of times to repeat each video (1-10)")

    def __str__(self) -> str:
        return f"Setting<{self.user_id}>"


class UserProgress(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress")
    phrase = models.ForeignKey(Phrase, null=True, blank=True, on_delete=models.CASCADE)
    expression = models.ForeignKey(Expression, null=True, blank=True, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    replay_count = models.PositiveIntegerField(default=0)
    last_reviewed = models.DateTimeField(null=True, blank=True)
    is_favorite = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "phrase", "expression"],
                name="uniq_user_progress_target",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "is_favorite"]),
        ]

    def touch_reviewed(self) -> None:
        self.last_reviewed = timezone.now()
        self.save(update_fields=["last_reviewed", "updated_at"])

    def __str__(self) -> str:
        return f"Progress<{self.user_id}:{self.phrase_id or self.expression_id}>"


class PlaybackLog(models.Model):
    SOURCE_CHOICES = [
        ("feed", "Feed"),
        ("favorites", "Favorites"),
        ("search", "Search"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="playback_logs")
    phrase = models.ForeignKey(Phrase, on_delete=models.CASCADE)
    play_ms = models.PositiveIntegerField()
    completed = models.BooleanField(default=False)
    source = models.CharField(max_length=32, blank=True, choices=SOURCE_CHOICES)
    device_type = models.CharField(max_length=32, blank=True)
    network_type = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"PlaybackLog<{self.user_id}:{self.phrase_id}>"