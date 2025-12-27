from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import time
from dataclasses import dataclass
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass(
    slots=True
)
class SignedMedia:
    url: str
    expires_in: int


def _normalize_key(key: str) -> str:
    return key.lstrip("/")


def build_media_url(key: str, *, sign: bool = False, ttl: int | None = None) -> str:
    """Return a public or pseudo-signed URL for Cloudflare R2 media."""
    normalized = _normalize_key(key)

    # R2が設定されていない場合はローカルMEDIA_URLを使用
    if not all([settings.R2_ACCESS_KEY, settings.R2_SECRET_KEY]):
        return f"{settings.SITE_URL}{settings.MEDIA_URL}{normalized}"

    base_url = settings.R2_PUBLIC_BASE_URL.rstrip("/")
    ttl = ttl or settings.R2_SIGNED_URL_TTL

    if not sign:
        return f"{base_url}/{normalized}"

    expires = int(time.time()) + ttl
    payload = f"{normalized}:{expires}".encode()
    signature = hmac.new(
        settings.R2_SECRET_KEY.encode(), payload, hashlib.sha256
    ).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()
    return (
        f"{base_url}/{normalized}?Expires={expires}&Signature={signature_b64}"
        f"&Key-Pair-Id={settings.R2_ACCESS_KEY}"
    )

def build_signed_media(key: str, ttl: int | None = None) -> SignedMedia:
    ttl = ttl or settings.R2_SIGNED_URL_TTL
    return SignedMedia(url=build_media_url(key, sign=True, ttl=ttl), expires_in=ttl)


def get_user_settings(user) -> Any:
    from .models import UserSetting

    setting, _ = UserSetting.objects.get_or_create(user=user)
    return setting


def send_verification_email(user, token: str) -> None:
    """
    メール確認用のメールを送信

    Args:
        user: Userオブジェクト
        token: 確認用トークン（UUID）
    """
    from django.core.mail import send_mail
    from django.conf import settings

    # Use HTTP redirect page that opens the app (works in email clients)
    if settings.APP_DEEP_LINK_SCHEME:
        # Use redirect page that will open the app
        verification_url = f"{settings.SITE_URL}/verify-email-redirect/?token={token}"
    else:
        # Fallback to web URL format
        base_url = settings.FRONTEND_URL.rstrip('/')
        verification_url = f"{base_url}/verify-email?token={token}"

    subject = "映単語 - メールアドレスの確認"
    message = f"""
映単語へようこそ！

以下のリンクをクリックしてメールアドレスを確認してください：

{verification_url}

このリンクは24時間で期限切れになります。

このメールに心当たりがない場合は、無視してください。

映単語チーム
"""

    html_message = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1d4ed8;">映単語へようこそ！</h2>
        <p>以下のボタンをクリックしてメールアドレスを確認してください：</p>
        <div style="margin: 30px 0;">
            <a href="{verification_url}"
               style="background-color: #1d4ed8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                メールアドレスを確認する
            </a>
        </div>
        <p style="color: #666; font-size: 14px;">または、このリンクをブラウザにコピー＆ペーストしてください：</p>
        <p style="color: #1d4ed8; font-size: 14px; word-break: break-all;">{verification_url}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
            このリンクは24時間で期限切れになります。<br>
            このメールに心当たりがない場合は、無視してください。
        </p>
    </div>
</body>
</html>
"""

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )


def send_password_reset_email(user, token: str) -> None:
    """
    パスワードリセット用のメールを送信

    Args:
        user: Userオブジェクト
        token: リセット用トークン（UUID）
    """
    from django.core.mail import send_mail
    from django.conf import settings

    # Use HTTP redirect page that opens the app (works in email clients)
    if settings.APP_DEEP_LINK_SCHEME:
        # Use redirect page that will open the app
        reset_url = f"{settings.SITE_URL}/reset-password-redirect/?token={token}"
    else:
        # Fallback to web URL format
        base_url = settings.FRONTEND_URL.rstrip('/')
        reset_url = f"{base_url}/reset-password?token={token}"

    subject = "映単語 - パスワードのリセット"
    message = f"""
こんにちは、

映単語のパスワードリセットをリクエストされました。

以下のリンクをクリックしてパスワードをリセットしてください：

{reset_url}

このリンクは1時間で期限切れになります。

パスワードリセットをリクエストしていない場合は、このメールを無視してください。

映単語チーム
"""

    html_message = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1d4ed8;">パスワードのリセット</h2>
        <p>映単語のパスワードリセットをリクエストされました。</p>
        <p>以下のボタンをクリックしてパスワードをリセットしてください：</p>
        <div style="margin: 30px 0;">
            <a href="{reset_url}"
               style="background-color: #1d4ed8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                パスワードをリセットする
            </a>
        </div>
        <p style="color: #666; font-size: 14px;">または、このリンクをブラウザにコピー＆ペーストしてください：</p>
        <p style="color: #1d4ed8; font-size: 14px; word-break: break-all;">{reset_url}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
            このリンクは1時間で期限切れになります。<br>
            パスワードリセットをリクエストしていない場合は、このメールを無視してください。
        </p>
    </div>
</body>
</html>
"""

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )


def send_contact_email(user, subject_type: str, message: str) -> None:
    """
    管理者に問い合わせメールを送信

    Args:
        user: 送信者のUserオブジェクト
        subject_type: 問い合わせの種類 (bug_report, feature_request, other)
        message: 問い合わせ内容
    """
    from django.core.mail import send_mail
    from django.conf import settings
    from django.utils import timezone

    # Subject type mapping to Japanese
    subject_mapping = {
        'bug_report': 'バグ報告',
        'feature_request': '機能リクエスト',
        'other': 'その他のお問い合わせ',
    }

    subject_label = subject_mapping.get(subject_type, 'お問い合わせ')
    email_subject = f"[映単語] {subject_label} - {user.email}"

    # Plain text version
    plain_message = f"""
映単語アプリからのお問い合わせ

種類: {subject_label}
送信者: {user.email}
送信日時: {timezone.now().strftime('%Y年%m月%d日 %H:%M:%S')}

--- メッセージ ---
{message}
---

※このメールは映単語アプリの問い合わせフォームから自動送信されています。
"""

    # HTML version
    html_message = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px;">
            映単語アプリからのお問い合わせ
        </h2>

        <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px; background-color: #f8fafc; font-weight: bold; width: 120px;">種類:</td>
                <td style="padding: 8px;">{subject_label}</td>
            </tr>
            <tr>
                <td style="padding: 8px; background-color: #f8fafc; font-weight: bold;">送信者:</td>
                <td style="padding: 8px;">{user.email}</td>
            </tr>
            <tr>
                <td style="padding: 8px; background-color: #f8fafc; font-weight: bold;">送信日時:</td>
                <td style="padding: 8px;">{timezone.now().strftime('%Y年%m月%d日 %H:%M:%S')}</td>
            </tr>
        </table>

        <div style="background-color: #f8fafc; padding: 20px; border-left: 4px solid #1d4ed8; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1b263b;">メッセージ:</h3>
            <p style="white-space: pre-wrap; margin: 0;">{message}</p>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            このメールは映単語アプリの問い合わせフォームから自動送信されています。
        </p>
    </div>
</body>
</html>
"""

    # Get admin email from settings
    admin_email = getattr(settings, 'ADMIN_EMAIL', settings.DEFAULT_FROM_EMAIL)

    send_mail(
        email_subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [admin_email],
        html_message=html_message,
        fail_silently=False,
    )


def _get_content_type(file_obj, key: str) -> str:
    """ファイルの適切なContent-Typeを判定"""
    import mimetypes

    # ファイルオブジェクトからContent-Typeを取得
    if hasattr(file_obj, 'content_type') and file_obj.content_type:
        return file_obj.content_type

    # 拡張子から判定
    content_type, _ = mimetypes.guess_type(key)
    if content_type:
        return content_type

    # デフォルト
    return 'application/octet-stream'


def upload_to_r2(file_obj, key: str, cache_control: str | None = None) -> str:
    """
    Upload a file to Cloudflare R2 and return the key.

    Args:
        file_obj: ファイルオブジェクト
        key: R2のオブジェクトキー（パス）
        cache_control: Cache-Controlヘッダー（Noneの場合はデフォルト）
    """
    import boto3
    from django.conf import settings

    # R2の設定が不完全な場合はローカルに保存
    if not all([settings.R2_ACCESS_KEY, settings.R2_SECRET_KEY, settings.R2_BUCKET_NAME]):
        # ローカル保存にフォールバック
        import os
        media_path = os.path.join(settings.MEDIA_ROOT, key)
        os.makedirs(os.path.dirname(media_path), exist_ok=True)
        with open(media_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)
        return key

    # Content-Typeを判定
    content_type = _get_content_type(file_obj, key)

    # ExtraArgsを構築
    extra_args = {
        'ContentType': content_type,
    }

    # Cache-Controlを設定（デフォルトは1年キャッシュ）
    if cache_control is None:
        cache_control = getattr(settings, 'R2_CACHE_CONTROL_PUBLIC', 'public, max-age=31536000, immutable')

    if cache_control:
        extra_args['CacheControl'] = cache_control

    # R2にアップロード
    s3_client = boto3.client(
        's3',
        endpoint_url=settings.R2_SIGNING_ENDPOINT or f'https://{settings.R2_BUCKET_NAME}.r2.cloudflarestorage.com',
        aws_access_key_id=settings.R2_ACCESS_KEY,
        aws_secret_access_key=settings.R2_SECRET_KEY,
        region_name='auto',
    )

    s3_client.upload_fileobj(
        file_obj,
        settings.R2_BUCKET_NAME,
        key,
        ExtraArgs=extra_args
    )

    return key


def generate_video_thumbnail(video_file, output_key: str) -> str | None:
    """
    動画の1フレーム目からサムネイル画像を生成してR2にアップロード

    Args:
        video_file: 動画ファイルオブジェクト
        output_key: 出力画像のR2キー（例: "thumbnails/xxx.jpg"）

    Returns:
        アップロードされたサムネイルのキー、失敗時はNone
    """
    import io
    import tempfile
    import os
    import ffmpeg
    from PIL import Image

    try:
        # 一時ファイルに動画を保存
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_video:
            for chunk in video_file.chunks():
                tmp_video.write(chunk)
            tmp_video_path = tmp_video.name

        # 動画の1フレーム目を抽出（JPEGとして）
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_thumb:
            tmp_thumb_path = tmp_thumb.name

        # ffmpegで1フレーム目を抽出
        (
            ffmpeg
            .input(tmp_video_path, ss=0)
            .filter('scale', 720, -1)  # 幅720pxにリサイズ
            .output(tmp_thumb_path, vframes=1, format='image2', vcodec='mjpeg')
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True, quiet=True)
        )

        # 生成されたサムネイルをR2にアップロード
        with open(tmp_thumb_path, 'rb') as thumb_file:
            # BytesIOに読み込んでDjangoのFileオブジェクトとして扱う
            from django.core.files.uploadedfile import InMemoryUploadedFile
            thumb_content = thumb_file.read()
            thumb_io = io.BytesIO(thumb_content)

            # InMemoryUploadedFileを作成
            thumbnail = InMemoryUploadedFile(
                thumb_io,
                None,
                output_key.split('/')[-1],
                'image/jpeg',
                len(thumb_content),
                None
            )

            # R2にアップロード
            upload_to_r2(thumbnail, output_key)

        # 一時ファイルを削除
        os.unlink(tmp_video_path)
        os.unlink(tmp_thumb_path)

        return output_key

    except Exception as e:
        # エラーログを出力
        logger.error(f"Error generating thumbnail: {e}", exc_info=True)
        # 一時ファイルのクリーンアップ
        try:
            if 'tmp_video_path' in locals():
                os.unlink(tmp_video_path)
            if 'tmp_thumb_path' in locals():
                os.unlink(tmp_thumb_path)
        except:
            pass
        return None