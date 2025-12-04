#!/usr/bin/env python
"""
CSV形式のデータからPhraseモデルにデータを一括インポートするスクリプト

CSVフォーマット:
text,meaning,topic,video_url
"Hello, how are you?","こんにちは、お元気ですか？",daily,https://example.com/video1.mp4
"Where is the nearest store?","一番近い店はどこですか？",shopping,https://example.com/video2.mp4

使い方:
    python import_phrases.py data.csv
"""

import os
import sys
import uuid
from io import BytesIO
from pathlib import Path

import django
import pandas as pd
import requests
from django.core.files.uploadedfile import InMemoryUploadedFile

# Djangoの設定を読み込む
sys.path.insert(0, str(Path(__file__).parent / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from phrases.models import Phrase
from phrases.services import upload_to_r2


def download_video(url: str) -> tuple[BytesIO, str]:
    """
    URLから動画をダウンロード

    Args:
        url: 動画のURL

    Returns:
        (BytesIOオブジェクト, ファイル名)
    """
    print(f"  Downloading video from: {url}")
    response = requests.get(url, stream=True, timeout=60)
    response.raise_for_status()

    # ファイル名を推測
    filename = url.split("/")[-1].split("?")[0]
    if not filename.endswith(('.mp4', '.mov', '.avi', '.webm')):
        filename += '.mp4'

    # BytesIOに保存
    video_content = BytesIO()
    total_size = 0
    for chunk in response.iter_content(chunk_size=8192):
        if chunk:
            video_content.write(chunk)
            total_size += len(chunk)

    video_content.seek(0)
    print(f"  Downloaded {total_size / (1024 * 1024):.2f} MB")

    return video_content, filename


def create_uploaded_file(content: BytesIO, filename: str) -> InMemoryUploadedFile:
    """
    BytesIOからDjangoのInMemoryUploadedFileを作成

    Args:
        content: ファイルの内容
        filename: ファイル名

    Returns:
        InMemoryUploadedFile
    """
    content.seek(0)
    size = len(content.getvalue())

    return InMemoryUploadedFile(
        content,
        None,
        filename,
        'video/mp4',
        size,
        None
    )


def import_csv(csv_path: str, skip_existing: bool = True) -> None:
    """
    CSVファイルからPhraseデータをインポート

    Args:
        csv_path: CSVファイルのパス
        skip_existing: 既存のテキストをスキップするかどうか
    """
    if not os.path.exists(csv_path):
        print(f"Error: File not found: {csv_path}")
        sys.exit(1)

    print(f"Importing phrases from: {csv_path}")
    print("-" * 60)

    # pandasでCSVを読み込み
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        sys.exit(1)

    # 必須カラムのチェック
    required_columns = ['text', 'meaning', 'topic', 'video_url']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        print(f"Error: CSV must have columns: {', '.join(required_columns)}")
        print(f"Missing columns: {', '.join(missing_columns)}")
        print(f"Found columns: {', '.join(df.columns)}")
        sys.exit(1)

    print(f"Loaded {len(df)} rows from CSV")
    print()

    success_count = 0
    skip_count = 0
    error_count = 0

    # データフレームをループ処理
    for idx, row in df.iterrows():
        row_num = idx + 2  # CSVのヘッダーが1行目なので+2

        # NaN値をチェックして空文字列に変換
        text = str(row['text']).strip() if pd.notna(row['text']) else ''
        meaning = str(row['meaning']).strip() if pd.notna(row['meaning']) else ''
        topic = str(row['topic']).strip().lower() if pd.notna(row['topic']) else ''
        video_url = str(row['video_url']).strip() if pd.notna(row['video_url']) else ''

        print(f"Row {row_num}: {text[:50]}...")

        # バリデーション
        if not all([text, meaning, topic, video_url]):
            print(f"  ❌ Skipped: Missing required fields")
            error_count += 1
            continue

        # トピックのバリデーション
        valid_topics = [choice[0] for choice in Phrase.TOPIC_CHOICES]
        if topic not in valid_topics:
            print(f"  ❌ Skipped: Invalid topic '{topic}'. Valid topics: {', '.join(valid_topics)}")
            error_count += 1
            continue

        # 既存チェック
        if skip_existing and Phrase.objects.filter(text=text).exists():
            print(f"  ⏭️  Skipped: Already exists")
            skip_count += 1
            continue

        try:
            # 動画をダウンロード
            video_content, filename = download_video(video_url)

            # R2にアップロード用のキーを生成
            video_key = f"videos/{uuid.uuid4()}.mp4"

            # InMemoryUploadedFileを作成
            uploaded_file = create_uploaded_file(video_content, filename)

            # R2にアップロード
            print(f"  Uploading to R2: {video_key}")
            upload_to_r2(uploaded_file, video_key)

            # Phraseオブジェクトを作成
            phrase = Phrase.objects.create(
                text=text,
                meaning=meaning,
                topic=topic,
                video_key=video_key,
            )

            print(f"  ✅ Created: Phrase ID {phrase.id}")
            success_count += 1

        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
            error_count += 1
            continue

    print("\n" + "=" * 60)
    print("Import completed!")
    print(f"  ✅ Success: {success_count}")
    print(f"  ⏭️  Skipped: {skip_count}")
    print(f"  ❌ Errors:  {error_count}")
    print(f"  📊 Total:   {success_count + skip_count + error_count}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python import_phrases.py <csv_file>")
        print("\nCSV format:")
        print("text,meaning,topic,video_url")
        print('"Hello, how are you?","こんにちは、お元気ですか？",daily,https://example.com/video1.mp4')
        sys.exit(1)

    csv_path = sys.argv[1]
    import_csv(csv_path)


if __name__ == "__main__":
    main()
