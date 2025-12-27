from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from rest_framework import serializers

from . import models, services

User = get_user_model()


class ExpressionSerializer(serializers.ModelSerializer):
    video_url = serializers.SerializerMethodField()
    scene_image_url = serializers.SerializerMethodField()

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
            "video_url",
            "scene_image_url",
            "order",
        ]

    def get_video_url(self, obj: models.Expression) -> str | None:
        if not obj.video_key:
            return None
        use_signed_url = True
        return services.build_media_url(obj.video_key, sign=use_signed_url)

    def get_scene_image_url(self, obj: models.Expression) -> str | None:
        if not obj.scene_image_key:
            return None
        return services.build_media_url(obj.scene_image_key, sign=False)


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
    expressions = PhraseExpressionSerializer(many=True, source="phraseexpression_set")
    video_url = serializers.SerializerMethodField()
    audio_url = serializers.SerializerMethodField()
    scene_image_url = serializers.SerializerMethodField()
    is_mastered = serializers.SerializerMethodField()

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
            "is_mastered",
            "expressions",
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

    def get_is_mastered(self, obj: models.Phrase) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        progress = models.UserProgress.objects.filter(
            user=request.user,
            phrase=obj,
            expression=None,
        ).first()
        return progress.is_mastered if progress else False


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


class MasteredToggleSerializer(serializers.Serializer):
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


class SignUpSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password != password_confirm:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": "This email is already registered."})

        return attrs

    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password
        )
        return user


class ContactFormSerializer(serializers.Serializer):
    subject = serializers.ChoiceField(
        choices=[
            ('bug_report', 'Bug Report'),
            ('feature_request', 'Feature Request'),
            ('other', 'Other'),
        ]
    )
    message = serializers.CharField(
        min_length=10,
        max_length=5000,
        error_messages={
            'min_length': 'Message must be at least 10 characters long.',
            'max_length': 'Message cannot exceed 5000 characters.',
        }
    )

    def validate_message(self, value):
        # Strip whitespace and validate non-empty
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Message cannot be empty or whitespace only.")
        return value