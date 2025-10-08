from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from rest_framework import serializers

from . import models, services

User = get_user_model()


class ExpressionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Expression
        fields = [
            "id",
            "type",
            "text",
            "meaning",
            "phonetic",
            "image_key",
            "audio_key",
            "order",
        ]


class PhraseExpressionSerializer(serializers.ModelSerializer):
    expression = ExpressionSerializer()

    class Meta:
        model = models.PhraseExpression
        fields = ["order", "expression"]


class PhraseSerializer(serializers.ModelSerializer):
    expressions = PhraseExpressionSerializer(many=True, source="phraseexpression_set")
    video_url = serializers.SerializerMethodField()
    audio_url = serializers.SerializerMethodField()
    scene_image_url = serializers.SerializerMethodField()

    class Meta:
        model = models.Phrase
        fields = [
            "id",
            "text",
            "meaning",
            "topic",
            "tags",
            "duration_sec",
            "difficulty",
            "video_url",
            "audio_url",
            "scene_image_url",
            "expressions",
        ]

    def get_video_url(self, obj: models.Phrase) -> str | None:
        if not obj.video_key:
            return None
        # 有料コンテンツは署名URL（セキュリティ）、無料は公開URL（CDNキャッシュ効率）
        # 将来的にobj.is_publicフラグで切り替え可能
        use_signed_url = True  # デフォルト: 署名URL（有料コンテンツ）
        return services.build_media_url(obj.video_key, sign=use_signed_url)

    def get_audio_url(self, obj: models.Phrase) -> str | None:
        if not obj.audio_key:
            return None
        use_signed_url = True
        return services.build_media_url(obj.audio_key, sign=use_signed_url)

    def get_scene_image_url(self, obj: models.Phrase) -> str | None:
        if not obj.scene_image_key:
            return None
        # 画像は通常公開URLでOK（署名不要）
        return services.build_media_url(obj.scene_image_key, sign=False)


class PhraseFeedSerializer(serializers.ModelSerializer):
    video_url = serializers.SerializerMethodField()
    audio_url = serializers.SerializerMethodField()
    scene_image_url = serializers.SerializerMethodField()

    class Meta:
        model = models.Phrase
        fields = [
            "id",
            "text",
            "meaning",
            "topic",
            "duration_sec",
            "difficulty",
            "video_url",
            "audio_url",
            "scene_image_url",
        ]

    def get_video_url(self, obj: models.Phrase) -> str | None:
        if not obj.video_key:
            return None
        use_signed_url = True  # デフォルト: 署名URL
        return services.build_media_url(obj.video_key, sign=use_signed_url)

    def get_audio_url(self, obj: models.Phrase) -> str | None:
        if not obj.audio_key:
            return None
        use_signed_url = True
        return services.build_media_url(obj.audio_key, sign=use_signed_url)

    def get_scene_image_url(self, obj: models.Phrase) -> str | None:
        if not obj.scene_image_key:
            return None
        # 画像は公開URL（署名不要）
        return services.build_media_url(obj.scene_image_key, sign=False)


class SettingsSerializer(serializers.ModelSerializer):
    playback_speed = serializers.FloatField(required=False)
    volume = serializers.FloatField(required=False)

    class Meta:
        model = models.UserSetting
        fields = ["playback_speed", "volume", "show_japanese", "repeat_count"]


class UserProgressSerializer(serializers.ModelSerializer):
    phrase = PhraseFeedSerializer(read_only=True)
    expression = ExpressionSerializer(read_only=True)

    class Meta:
        model = models.UserProgress
        fields = [
            "id",
            "phrase",
            "expression",
            "completed",
            "replay_count",
            "last_reviewed",
            "is_favorite",
        ]


class PlaybackLogSerializer(serializers.ModelSerializer):
    phrase_id = serializers.PrimaryKeyRelatedField(
        queryset=models.Phrase.objects.all(), source="phrase", write_only=True
    )

    class Meta:
        model = models.PlaybackLog
        fields = [
            "phrase_id",
            "play_ms",
            "completed",
            "source",
            "device_type",
            "network_type",
        ]

    def create(self, validated_data):
        user = self.context["request"].user
        phrase = validated_data.pop("phrase")
        log = models.PlaybackLog.objects.create(user=user, phrase=phrase, **validated_data)

        progress, _ = models.UserProgress.objects.get_or_create(
            user=user,
            phrase=phrase,
            expression=None,
        )
        if validated_data.get("completed"):
            progress.completed = True
        progress.replay_count = (progress.replay_count or 0) + 1
        progress.last_reviewed = timezone.now()
        progress.save(update_fields=["completed", "replay_count", "last_reviewed", "updated_at"])
        return log


class FavoriteToggleSerializer(serializers.Serializer):
    phrase_id = serializers.PrimaryKeyRelatedField(queryset=models.Phrase.objects.all(), source="phrase")
    on = serializers.BooleanField(default=True)


class MediaSignedUrlSerializer(serializers.Serializer):
    key = serializers.CharField()

    def create(self, validated_data):
        key = validated_data["key"]
        ttl_value = self.context.get("ttl")
        ttl = int(ttl_value) if ttl_value is not None else settings.R2_SIGNED_URL_TTL
        url = services.build_media_url(key, sign=True, ttl=ttl)
        return {"url": url, "expires_in": ttl}


class EmailLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        try:
            user = User.objects.get(email__iexact=email)
            username = user.get_username()
        except User.DoesNotExist:
            username = email
        user = authenticate(username=username, password=password)
        if not user:
            msg = "Unable to log in with provided credentials."
            raise serializers.ValidationError(msg, code="authorization")
        attrs["user"] = user
        return attrs