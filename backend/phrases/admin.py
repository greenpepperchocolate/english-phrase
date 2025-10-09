from django import forms
from django.contrib import admin
import uuid
from . import models, services


class ExpressionAdminForm(forms.ModelForm):
    image_upload = forms.FileField(required=False, help_text="画像ファイルをアップロード")
    audio_upload = forms.FileField(required=False, help_text="音声ファイルをアップロード")

    class Meta:
        model = models.Expression
        fields = '__all__'

    def save(self, commit=True):
        instance = super().save(commit=False)

        # 画像ファイルのアップロード
        if self.cleaned_data.get('image_upload'):
            image_file = self.cleaned_data['image_upload']
            ext = image_file.name.split('.')[-1]
            key = f"expressions/images/{uuid.uuid4()}.{ext}"
            services.upload_to_r2(image_file, key)
            instance.image_key = key

        # 音声ファイルのアップロード
        if self.cleaned_data.get('audio_upload'):
            audio_file = self.cleaned_data['audio_upload']
            ext = audio_file.name.split('.')[-1]
            key = f"expressions/audio/{uuid.uuid4()}.{ext}"
            services.upload_to_r2(audio_file, key)
            instance.audio_key = key

        if commit:
            instance.save()
        return instance


@admin.register(models.Expression)
class ExpressionAdmin(admin.ModelAdmin):
    form = ExpressionAdminForm
    list_display = ("id", "type", "text", "order", "created_at", "has_audio", "has_image")
    search_fields = ("text", "meaning")
    list_filter = ("type",)
    fieldsets = (
        ('基本情報', {
            'fields': ('type', 'text', 'meaning', 'phonetic', 'parent', 'order')
        }),
        ('メディアアップロード', {
            'fields': ('image_upload', 'audio_upload'),
        }),
        ('メディアキー（手動設定）', {
            'fields': ('image_key', 'audio_key'),
            'classes': ('collapse',),
        }),
    )

    def has_audio(self, obj):
        return bool(obj.audio_key)
    has_audio.boolean = True
    has_audio.short_description = '音声'

    def has_image(self, obj):
        return bool(obj.image_key)
    has_image.boolean = True
    has_image.short_description = '画像'


class PhraseExpressionInline(admin.TabularInline):
    model = models.PhraseExpression
    extra = 1


class PhraseAdminForm(forms.ModelForm):
    video_file = forms.FileField(required=False, help_text="動画ファイルをアップロード")
    audio_file = forms.FileField(required=False, help_text="音声ファイルをアップロード")
    scene_image_file = forms.FileField(required=False, help_text="シーン画像をアップロード")
    tags = forms.CharField(
        required=False,
        help_text='カンマ区切りで入力（例: travel, business, beginner）空欄でもOK',
        widget=forms.TextInput(attrs={'size': '60'})
    )

    class Meta:
        model = models.Phrase
        fields = '__all__'

    def clean_tags(self):
        """タグをカンマ区切りからJSON配列に変換"""
        tags_input = self.cleaned_data.get('tags', '')
        if not tags_input or tags_input.strip() == '':
            return []
        # カンマ区切りの文字列を配列に変換
        tags_list = [tag.strip() for tag in tags_input.split(',') if tag.strip()]
        return tags_list

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 既存のタグを表示用に変換
        if self.instance and self.instance.pk and self.instance.tags:
            self.fields['tags'].initial = ', '.join(self.instance.tags)

    def save(self, commit=True):
        instance = super().save(commit=False)

        # 動画ファイルのアップロード
        if self.cleaned_data.get('video_file'):
            video_file = self.cleaned_data['video_file']
            ext = video_file.name.split('.')[-1]
            key = f"videos/{uuid.uuid4()}.{ext}"
            services.upload_to_r2(video_file, key)
            instance.video_key = key

            # 動画の1フレーム目からサムネイルを自動生成
            # video_fileを再度シークする必要があるため、再度取得
            video_file.seek(0)
            thumbnail_key = f"thumbnails/{uuid.uuid4()}.jpg"
            generated_thumbnail = services.generate_video_thumbnail(video_file, thumbnail_key)
            if generated_thumbnail:
                instance.scene_image_key = generated_thumbnail

        # 音声ファイルのアップロード
        if self.cleaned_data.get('audio_file'):
            audio_file = self.cleaned_data['audio_file']
            ext = audio_file.name.split('.')[-1]
            key = f"audio/{uuid.uuid4()}.{ext}"
            services.upload_to_r2(audio_file, key)
            instance.audio_key = key

        # シーン画像のアップロード
        if self.cleaned_data.get('scene_image_file'):
            scene_image_file = self.cleaned_data['scene_image_file']
            ext = scene_image_file.name.split('.')[-1]
            key = f"images/{uuid.uuid4()}.{ext}"
            services.upload_to_r2(scene_image_file, key)
            instance.scene_image_key = key

        if commit:
            instance.save()
        return instance


@admin.register(models.Phrase)
class PhraseAdmin(admin.ModelAdmin):
    form = PhraseAdminForm
    list_display = ("id", "topic", "difficulty", "duration_sec", "has_video")
    search_fields = ("text", "meaning")
    list_filter = ("topic", "difficulty")
    inlines = [PhraseExpressionInline]
    fieldsets = (
        ('基本情報', {
            'fields': ('text', 'meaning', 'topic', 'tags', 'difficulty', 'duration_sec')
        }),
        ('メディアアップロード', {
            'fields': ('video_file', 'audio_file', 'scene_image_file'),
            'description': 'ファイルをアップロードすると、自動的にR2に保存されます'
        }),
        ('メディアキー（手動設定）', {
            'fields': ('video_key', 'audio_key', 'scene_image_key'),
            'classes': ('collapse',),
            'description': '既にR2にアップロード済みのファイルのキーを直接指定できます'
        }),
    )

    def has_video(self, obj):
        return bool(obj.video_key)
    has_video.boolean = True
    has_video.short_description = '動画'


@admin.register(models.UserSetting)
class UserSettingAdmin(admin.ModelAdmin):
    list_display = ("user", "playback_speed", "volume", "show_japanese")


@admin.register(models.UserProgress)
class UserProgressAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "phrase",
        "expression",
        "completed",
        "is_favorite",
        "last_reviewed",
    )
    list_filter = ("completed", "is_favorite")


@admin.register(models.PlaybackLog)
class PlaybackLogAdmin(admin.ModelAdmin):
    list_display = ("user", "phrase", "play_ms", "completed", "created_at")
    list_filter = ("completed", "source")


@admin.register(models.EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "is_verified", "verified_at", "created_at")
    list_filter = ("is_verified",)
    readonly_fields = ("token", "verified_at")


@admin.register(models.PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "is_used", "expires_at", "used_at", "created_at")
    list_filter = ("is_used",)
    readonly_fields = ("token", "used_at", "expires_at")
    ordering = ("-created_at",)