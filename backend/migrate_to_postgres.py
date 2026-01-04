#!/usr/bin/env python
"""
SQLiteからRender PostgreSQLへのデータ移行スクリプト

使用方法:
1. python migrate_to_postgres.py --export  (SQLiteからJSONにエクスポート)
2. python migrate_to_postgres.py --migrate (PostgreSQLにマイグレーション実行)
3. python migrate_to_postgres.py --import  (JSONからPostgreSQLにインポート)

または一括実行:
   python migrate_to_postgres.py --all
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Django設定を読み込む
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.core.management import call_command
from django.db import connection
from phrases.models import (
    Expression, Phrase, PhraseExpression, UserSetting,
    UserProgress, PlaybackLog, EmailVerificationToken, PasswordResetToken
)

# Render PostgreSQL External URL
POSTGRES_URL = "postgresql://english_app_sohi_user:G3W1myFrBBBiA1MIFU2mLsYpiEFFKnOW@dpg-d5as8c1r0fns738h12b0-a.oregon-postgres.render.com/english_app_sohi"

EXPORT_DIR = Path(__file__).parent / "data_export"


def export_data():
    """SQLiteから全データをJSONにエクスポート"""
    print("=== SQLiteからデータをエクスポート中... ===")

    EXPORT_DIR.mkdir(exist_ok=True)

    # Users
    users_data = []
    for user in User.objects.all():
        users_data.append({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'password': user.password,  # ハッシュ化済み
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_active': user.is_active,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'date_joined': user.date_joined.isoformat() if user.date_joined else None,
            'last_login': user.last_login.isoformat() if user.last_login else None,
        })
    with open(EXPORT_DIR / "users.json", "w", encoding="utf-8") as f:
        json.dump(users_data, f, ensure_ascii=False, indent=2)
    print(f"  Users: {len(users_data)}件")

    # Expressions
    expressions_data = []
    for expr in Expression.objects.all():
        expressions_data.append({
            'id': expr.id,
            'type': expr.type,
            'text': expr.text,
            'meaning': expr.meaning,
            'phonetic': expr.phonetic,
            'image_key': expr.image_key,
            'audio_key': expr.audio_key,
            'video_key': expr.video_key,
            'scene_image_key': expr.scene_image_key,
            'parent_id': expr.parent_id,
            'order': expr.order,
            'created_at': expr.created_at.isoformat(),
            'updated_at': expr.updated_at.isoformat(),
        })
    with open(EXPORT_DIR / "expressions.json", "w", encoding="utf-8") as f:
        json.dump(expressions_data, f, ensure_ascii=False, indent=2)
    print(f"  Expressions: {len(expressions_data)}件")

    # Phrases
    phrases_data = []
    for phrase in Phrase.objects.all():
        phrases_data.append({
            'id': phrase.id,
            'text': phrase.text,
            'meaning': phrase.meaning,
            'topic': phrase.topic,
            'tags': phrase.tags,
            'audio_key': phrase.audio_key,
            'video_key': phrase.video_key,
            'scene_image_key': phrase.scene_image_key,
            'duration_sec': phrase.duration_sec,
            'difficulty': phrase.difficulty,
            'created_at': phrase.created_at.isoformat(),
            'updated_at': phrase.updated_at.isoformat(),
        })
    with open(EXPORT_DIR / "phrases.json", "w", encoding="utf-8") as f:
        json.dump(phrases_data, f, ensure_ascii=False, indent=2)
    print(f"  Phrases: {len(phrases_data)}件")

    # PhraseExpressions
    phrase_expressions_data = []
    for pe in PhraseExpression.objects.all():
        phrase_expressions_data.append({
            'id': pe.id,
            'phrase_id': pe.phrase_id,
            'expression_id': pe.expression_id,
            'order': pe.order,
        })
    with open(EXPORT_DIR / "phrase_expressions.json", "w", encoding="utf-8") as f:
        json.dump(phrase_expressions_data, f, ensure_ascii=False, indent=2)
    print(f"  PhraseExpressions: {len(phrase_expressions_data)}件")

    # UserSettings
    user_settings_data = []
    for setting in UserSetting.objects.all():
        user_settings_data.append({
            'id': setting.id,
            'user_id': setting.user_id,
            'playback_speed': str(setting.playback_speed),
            'volume': str(setting.volume),
            'show_japanese': setting.show_japanese,
            'repeat_count': setting.repeat_count,
            'created_at': setting.created_at.isoformat(),
            'updated_at': setting.updated_at.isoformat(),
        })
    with open(EXPORT_DIR / "user_settings.json", "w", encoding="utf-8") as f:
        json.dump(user_settings_data, f, ensure_ascii=False, indent=2)
    print(f"  UserSettings: {len(user_settings_data)}件")

    # UserProgress
    user_progress_data = []
    for progress in UserProgress.objects.all():
        user_progress_data.append({
            'id': progress.id,
            'user_id': progress.user_id,
            'phrase_id': progress.phrase_id,
            'expression_id': progress.expression_id,
            'completed': progress.completed,
            'replay_count': progress.replay_count,
            'last_reviewed': progress.last_reviewed.isoformat() if progress.last_reviewed else None,
            'is_favorite': progress.is_favorite,
            'is_mastered': progress.is_mastered,
            'created_at': progress.created_at.isoformat(),
            'updated_at': progress.updated_at.isoformat(),
        })
    with open(EXPORT_DIR / "user_progress.json", "w", encoding="utf-8") as f:
        json.dump(user_progress_data, f, ensure_ascii=False, indent=2)
    print(f"  UserProgress: {len(user_progress_data)}件")

    # PlaybackLogs
    playback_logs_data = []
    for log in PlaybackLog.objects.all():
        playback_logs_data.append({
            'id': log.id,
            'user_id': log.user_id,
            'phrase_id': log.phrase_id,
            'play_ms': log.play_ms,
            'completed': log.completed,
            'source': log.source,
            'device_type': log.device_type,
            'network_type': log.network_type,
            'created_at': log.created_at.isoformat(),
        })
    with open(EXPORT_DIR / "playback_logs.json", "w", encoding="utf-8") as f:
        json.dump(playback_logs_data, f, ensure_ascii=False, indent=2)
    print(f"  PlaybackLogs: {len(playback_logs_data)}件")

    # EmailVerificationTokens
    email_tokens_data = []
    for token in EmailVerificationToken.objects.all():
        email_tokens_data.append({
            'id': token.id,
            'user_id': token.user_id,
            'token': str(token.token),
            'is_verified': token.is_verified,
            'verified_at': token.verified_at.isoformat() if token.verified_at else None,
            'created_at': token.created_at.isoformat(),
            'updated_at': token.updated_at.isoformat(),
        })
    with open(EXPORT_DIR / "email_verification_tokens.json", "w", encoding="utf-8") as f:
        json.dump(email_tokens_data, f, ensure_ascii=False, indent=2)
    print(f"  EmailVerificationTokens: {len(email_tokens_data)}件")

    # PasswordResetTokens
    password_tokens_data = []
    for token in PasswordResetToken.objects.all():
        password_tokens_data.append({
            'id': token.id,
            'user_id': token.user_id,
            'token': str(token.token),
            'is_used': token.is_used,
            'used_at': token.used_at.isoformat() if token.used_at else None,
            'expires_at': token.expires_at.isoformat(),
            'created_at': token.created_at.isoformat(),
            'updated_at': token.updated_at.isoformat(),
        })
    with open(EXPORT_DIR / "password_reset_tokens.json", "w", encoding="utf-8") as f:
        json.dump(password_tokens_data, f, ensure_ascii=False, indent=2)
    print(f"  PasswordResetTokens: {len(password_tokens_data)}件")

    print(f"\n=== エクスポート完了: {EXPORT_DIR} ===")


def run_migrations():
    """PostgreSQLにマイグレーションを実行"""
    print("=== PostgreSQLにマイグレーションを実行中... ===")
    print(f"接続先: {POSTGRES_URL.split('@')[1]}")  # パスワードを隠す

    # DATABASE_URLを設定
    os.environ['DATABASE_URL'] = POSTGRES_URL

    # Django設定をリロード
    from django.conf import settings
    import dj_database_url
    settings.DATABASES['default'] = dj_database_url.parse(POSTGRES_URL, conn_max_age=600)

    # マイグレーション実行
    call_command('migrate', '--run-syncdb', verbosity=1)
    print("\n=== マイグレーション完了 ===")


def clear_postgres_data():
    """PostgreSQLの全データを削除"""
    print("=== PostgreSQLのデータを削除中... ===")

    # DATABASE_URLを設定
    os.environ['DATABASE_URL'] = POSTGRES_URL

    # Django設定をリロード
    from django.conf import settings
    import dj_database_url
    from django.db import connections

    settings.DATABASES['default'] = dj_database_url.parse(POSTGRES_URL, conn_max_age=600)

    # 接続をリセット
    connections['default'].close()

    # 依存関係の順番で削除（外部キー制約を考慮）
    print("  PlaybackLogsを削除中...")
    PlaybackLog.objects.all().delete()
    print("  UserProgressを削除中...")
    UserProgress.objects.all().delete()
    print("  UserSettingsを削除中...")
    UserSetting.objects.all().delete()
    print("  PasswordResetTokensを削除中...")
    PasswordResetToken.objects.all().delete()
    print("  EmailVerificationTokensを削除中...")
    EmailVerificationToken.objects.all().delete()
    print("  PhraseExpressionsを削除中...")
    PhraseExpression.objects.all().delete()
    print("  Phrasesを削除中...")
    Phrase.objects.all().delete()
    print("  Expressionsを削除中...")
    Expression.objects.all().delete()
    print("  Usersを削除中...")
    User.objects.all().delete()

    print("\n=== PostgreSQLデータ削除完了 ===")


def import_data(clear_first=False):
    """JSONからPostgreSQLにデータをインポート"""

    if clear_first:
        clear_postgres_data()

    print("=== PostgreSQLにデータをインポート中... ===")

    # DATABASE_URLを設定
    os.environ['DATABASE_URL'] = POSTGRES_URL

    # Django設定をリロード
    from django.conf import settings
    import dj_database_url
    from django.db import connections
    from decimal import Decimal
    from datetime import datetime
    import uuid

    settings.DATABASES['default'] = dj_database_url.parse(POSTGRES_URL, conn_max_age=600)

    # 接続をリセット
    connections['default'].close()

    def parse_datetime(s):
        if s is None:
            return None
        return datetime.fromisoformat(s.replace('Z', '+00:00'))

    # Users
    print("  Usersをインポート中...")
    with open(EXPORT_DIR / "users.json", "r", encoding="utf-8") as f:
        users_data = json.load(f)

    for data in users_data:
        user, created = User.objects.update_or_create(
            id=data['id'],
            defaults={
                'username': data['username'],
                'email': data['email'],
                'password': data['password'],
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'is_active': data['is_active'],
                'is_staff': data['is_staff'],
                'is_superuser': data['is_superuser'],
            }
        )
        if data['date_joined']:
            User.objects.filter(id=data['id']).update(
                date_joined=parse_datetime(data['date_joined']),
                last_login=parse_datetime(data['last_login'])
            )
    print(f"    {len(users_data)}件完了")

    # Expressions (parentがあるので2パスで処理)
    print("  Expressionsをインポート中...")
    with open(EXPORT_DIR / "expressions.json", "r", encoding="utf-8") as f:
        expressions_data = json.load(f)

    # 最初にparent_id=Nullのものを作成
    for data in expressions_data:
        Expression.objects.update_or_create(
            id=data['id'],
            defaults={
                'type': data['type'],
                'text': data['text'],
                'meaning': data['meaning'],
                'phonetic': data['phonetic'],
                'image_key': data['image_key'],
                'audio_key': data['audio_key'],
                'video_key': data['video_key'],
                'scene_image_key': data['scene_image_key'],
                'parent_id': None,  # 最初はNullで作成
                'order': data['order'],
            }
        )
    # parent_idを更新
    for data in expressions_data:
        if data['parent_id']:
            Expression.objects.filter(id=data['id']).update(parent_id=data['parent_id'])
    print(f"    {len(expressions_data)}件完了")

    # Phrases
    print("  Phrasesをインポート中...")
    with open(EXPORT_DIR / "phrases.json", "r", encoding="utf-8") as f:
        phrases_data = json.load(f)

    for data in phrases_data:
        Phrase.objects.update_or_create(
            id=data['id'],
            defaults={
                'text': data['text'],
                'meaning': data['meaning'],
                'topic': data['topic'],
                'tags': data['tags'],
                'audio_key': data['audio_key'],
                'video_key': data['video_key'],
                'scene_image_key': data['scene_image_key'],
                'duration_sec': data['duration_sec'],
                'difficulty': data['difficulty'],
            }
        )
    print(f"    {len(phrases_data)}件完了")

    # PhraseExpressions
    print("  PhraseExpressionsをインポート中...")
    with open(EXPORT_DIR / "phrase_expressions.json", "r", encoding="utf-8") as f:
        phrase_expressions_data = json.load(f)

    for data in phrase_expressions_data:
        PhraseExpression.objects.update_or_create(
            id=data['id'],
            defaults={
                'phrase_id': data['phrase_id'],
                'expression_id': data['expression_id'],
                'order': data['order'],
            }
        )
    print(f"    {len(phrase_expressions_data)}件完了")

    # UserSettings
    print("  UserSettingsをインポート中...")
    with open(EXPORT_DIR / "user_settings.json", "r", encoding="utf-8") as f:
        user_settings_data = json.load(f)

    for data in user_settings_data:
        UserSetting.objects.update_or_create(
            id=data['id'],
            defaults={
                'user_id': data['user_id'],
                'playback_speed': Decimal(data['playback_speed']),
                'volume': Decimal(data['volume']),
                'show_japanese': data['show_japanese'],
                'repeat_count': data['repeat_count'],
            }
        )
    print(f"    {len(user_settings_data)}件完了")

    # UserProgress
    print("  UserProgressをインポート中...")
    with open(EXPORT_DIR / "user_progress.json", "r", encoding="utf-8") as f:
        user_progress_data = json.load(f)

    for data in user_progress_data:
        UserProgress.objects.update_or_create(
            id=data['id'],
            defaults={
                'user_id': data['user_id'],
                'phrase_id': data['phrase_id'],
                'expression_id': data['expression_id'],
                'completed': data['completed'],
                'replay_count': data['replay_count'],
                'last_reviewed': parse_datetime(data['last_reviewed']),
                'is_favorite': data['is_favorite'],
                'is_mastered': data['is_mastered'],
            }
        )
    print(f"    {len(user_progress_data)}件完了")

    # PlaybackLogs
    print("  PlaybackLogsをインポート中...")
    with open(EXPORT_DIR / "playback_logs.json", "r", encoding="utf-8") as f:
        playback_logs_data = json.load(f)

    for data in playback_logs_data:
        PlaybackLog.objects.update_or_create(
            id=data['id'],
            defaults={
                'user_id': data['user_id'],
                'phrase_id': data['phrase_id'],
                'play_ms': data['play_ms'],
                'completed': data['completed'],
                'source': data['source'],
                'device_type': data['device_type'],
                'network_type': data['network_type'],
            }
        )
    print(f"    {len(playback_logs_data)}件完了")

    # EmailVerificationTokens
    print("  EmailVerificationTokensをインポート中...")
    with open(EXPORT_DIR / "email_verification_tokens.json", "r", encoding="utf-8") as f:
        email_tokens_data = json.load(f)

    for data in email_tokens_data:
        obj, created = EmailVerificationToken.objects.update_or_create(
            id=data['id'],
            defaults={
                'user_id': data['user_id'],
                'is_verified': data['is_verified'],
                'verified_at': parse_datetime(data['verified_at']),
            }
        )
        # tokenはUUIDフィールドなので直接更新
        EmailVerificationToken.objects.filter(id=data['id']).update(token=uuid.UUID(data['token']))
    print(f"    {len(email_tokens_data)}件完了")

    # PasswordResetTokens
    print("  PasswordResetTokensをインポート中...")
    with open(EXPORT_DIR / "password_reset_tokens.json", "r", encoding="utf-8") as f:
        password_tokens_data = json.load(f)

    for data in password_tokens_data:
        obj, created = PasswordResetToken.objects.update_or_create(
            id=data['id'],
            defaults={
                'user_id': data['user_id'],
                'is_used': data['is_used'],
                'used_at': parse_datetime(data['used_at']),
                'expires_at': parse_datetime(data['expires_at']),
            }
        )
        PasswordResetToken.objects.filter(id=data['id']).update(token=uuid.UUID(data['token']))
    print(f"    {len(password_tokens_data)}件完了")

    # シーケンスをリセット
    print("\n  シーケンスをリセット中...")
    reset_sequences()

    print("\n=== インポート完了 ===")


def reset_sequences():
    """PostgreSQLのシーケンスをリセット"""
    from django.db import connection

    tables = [
        ('auth_user', 'id'),
        ('phrases_expression', 'id'),
        ('phrases_phrase', 'id'),
        ('phrases_phraseexpression', 'id'),
        ('phrases_usersetting', 'id'),
        ('phrases_userprogress', 'id'),
        ('phrases_playbacklog', 'id'),
        ('phrases_emailverificationtoken', 'id'),
        ('phrases_passwordresettoken', 'id'),
    ]

    with connection.cursor() as cursor:
        for table, column in tables:
            try:
                cursor.execute(f"""
                    SELECT setval(pg_get_serial_sequence('{table}', '{column}'),
                           COALESCE((SELECT MAX({column}) FROM {table}), 1), true)
                """)
            except Exception as e:
                print(f"    警告: {table}のシーケンスリセットに失敗: {e}")


def main():
    parser = argparse.ArgumentParser(description='SQLiteからPostgreSQLへのデータ移行')
    parser.add_argument('--export', action='store_true', help='SQLiteからJSONにエクスポート')
    parser.add_argument('--migrate', action='store_true', help='PostgreSQLにマイグレーション実行')
    parser.add_argument('--import', dest='import_data', action='store_true', help='JSONからPostgreSQLにインポート')
    parser.add_argument('--clear', action='store_true', help='PostgreSQLの全データを削除')
    parser.add_argument('--sync', action='store_true', help='SQLiteをエクスポート→PostgreSQLを削除→インポート（完全同期）')
    parser.add_argument('--all', action='store_true', help='全ステップを実行')

    args = parser.parse_args()

    if not any([args.export, args.migrate, args.import_data, args.clear, args.sync, args.all]):
        parser.print_help()
        return

    if args.sync:
        # 完全同期：エクスポート→削除→インポート
        export_data()
        import_data(clear_first=True)
        print("\n" + "=" * 50)
        print("同期が完了しました！")
        print("=" * 50)
        return

    if args.clear:
        clear_postgres_data()

    if args.all or args.export:
        export_data()

    if args.all or args.migrate:
        run_migrations()

    if args.all or args.import_data:
        import_data()

    print("\n" + "=" * 50)
    print("移行が完了しました！")
    print("=" * 50)


if __name__ == '__main__':
    main()
