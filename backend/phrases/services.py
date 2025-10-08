from __future__ import annotations

import base64
import hashlib
import hmac
import time
from dataclasses import dataclass
from typing import Any

from django.conf import settings


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
        # エラーログを出力（本番環境ではloggerを使用推奨）
        print(f"Error generating thumbnail: {e}")
        # 一時ファイルのクリーンアップ
        try:
            if 'tmp_video_path' in locals():
                os.unlink(tmp_video_path)
            if 'tmp_thumb_path' in locals():
                os.unlink(tmp_thumb_path)
        except:
            pass
        return None