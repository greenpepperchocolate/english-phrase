from __future__ import annotations

import secrets

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, mixins, permissions, status
from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from . import models, serializers, services

User = get_user_model()


class FeedPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "limit"
    max_page_size = 100


class PhraseFeedView(generics.ListAPIView):
    serializer_class = serializers.PhraseFeedSerializer
    pagination_class = FeedPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        from django.db.models import Q, Exists, OuterRef

        topic = self.request.query_params.get("topic")
        difficulty = self.request.query_params.get("difficulty")
        search = self.request.query_params.get("search")
        qs = models.Phrase.objects.prefetch_related("phraseexpression_set__expression")
        if topic:
            qs = qs.filter(topic__iexact=topic)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        if search:
            qs = qs.filter(Q(text__icontains=search) | Q(meaning__icontains=search))

        from django.db.models import F
        from django.db.models.functions import Mod, Cast
        from django.db.models import IntegerField

        # Get random seed from query params (generated per session by frontend)
        seed_param = self.request.query_params.get('seed')
        if seed_param:
            try:
                seed = int(seed_param)
            except (ValueError, TypeError):
                seed = 1  # Default seed if invalid
        else:
            seed = 1  # Default seed if not provided

        # If user is authenticated, annotate is_mastered for filtering
        if self.request.user.is_authenticated:
            mastered_subquery = models.UserProgress.objects.filter(
                user=self.request.user,
                phrase=OuterRef('pk'),
                is_mastered=True
            )
            qs = qs.annotate(
                is_mastered_by_user=Exists(mastered_subquery)
            )
            # Prioritize non-mastered phrases, then pseudo-random based on session seed
            # This ensures consistent ordering across pagination for the same session
            qs = qs.annotate(
                random_order=Mod(
                    Cast(F('id') * (seed * 2654435761), IntegerField()),
                    1000000
                )
            )
            return qs.order_by('is_mastered_by_user', 'random_order')
        else:
            # For anonymous users, pseudo-random based on session seed
            qs = qs.annotate(
                random_order=Mod(
                    Cast(F('id') * (seed * 2654435761), IntegerField()),
                    1000000
                )
            )
            return qs.order_by('random_order')


class PhraseDetailView(generics.RetrieveAPIView):
    serializer_class = serializers.PhraseSerializer
    lookup_url_kwarg = "phrase_id"
    queryset = models.Phrase.objects.prefetch_related("phraseexpression_set__expression")
    permission_classes = [permissions.AllowAny]


class FavoriteToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = serializers.FavoriteToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phrase = serializer.validated_data["phrase"]
        is_on = serializer.validated_data.get("on", True)

        progress, _ = models.UserProgress.objects.get_or_create(
            user=request.user,
            phrase=phrase,
            expression=None,
        )
        progress.is_favorite = is_on
        progress.last_reviewed = progress.last_reviewed or timezone.now()
        progress.save(update_fields=["is_favorite", "last_reviewed", "updated_at"])
        return Response({"phrase_id": phrase.id, "is_favorite": progress.is_favorite})


class MasteredToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = serializers.MasteredToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phrase = serializer.validated_data["phrase"]
        is_on = serializer.validated_data.get("on", True)

        progress, _ = models.UserProgress.objects.get_or_create(
            user=request.user,
            phrase=phrase,
            expression=None,
        )
        progress.is_mastered = is_on
        progress.last_reviewed = progress.last_reviewed or timezone.now()
        progress.save(update_fields=["is_mastered", "last_reviewed", "updated_at"])
        return Response({"phrase_id": phrase.id, "is_mastered": progress.is_mastered})


class PlaybackLogCreateView(generics.CreateAPIView):
    serializer_class = serializers.PlaybackLogSerializer
    permission_classes = [permissions.IsAuthenticated]


class UserSettingsView(generics.GenericAPIView, mixins.RetrieveModelMixin, mixins.UpdateModelMixin):
    serializer_class = serializers.SettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return services.get_user_settings(self.request.user)

    def get(self, request, *args, **kwargs):
        return self.retrieve(request, *args, **kwargs)

    def put(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)


class AuthSignUpView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = serializers.SignUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # ユーザー設定を作成
        services.get_user_settings(user)

        # メール確認トークンを作成
        verification_token = models.EmailVerificationToken.objects.create(user=user)

        # 確認メールを送信
        try:
            services.send_verification_email(user, str(verification_token.token))
        except Exception as e:
            # メール送信エラーはログに記録するが、サインアップ自体は成功とする
            print(f"Failed to send verification email: {e}")

        return Response(
            {
                "message": "Account created successfully. Please check your email to verify your account.",
                "email": user.email,
            },
            status=status.HTTP_201_CREATED
        )


class EmailVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response({"detail": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            verification = models.EmailVerificationToken.objects.get(token=token)

            if verification.is_verified:
                return Response({"detail": "Email already verified"}, status=status.HTTP_400_BAD_REQUEST)

            # トークンの有効期限チェック（24時間）
            from datetime import timedelta
            if verification.created_at < timezone.now() - timedelta(hours=24):
                return Response(
                    {"detail": "Verification token has expired. Please request a new one."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # メールを確認済みにする
            verification.verify()

            return Response(
                {"message": "Email verified successfully. You can now log in."},
                status=status.HTTP_200_OK
            )

        except models.EmailVerificationToken.DoesNotExist:
            return Response({"detail": "Invalid verification token"}, status=status.HTTP_400_BAD_REQUEST)


class AuthLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        provider = request.data.get("provider")
        if provider == "google":
            return Response(
                {"detail": "Google login is not yet implemented in this prototype."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        serializer = serializers.EmailLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # メール確認チェック
        try:
            verification = models.EmailVerificationToken.objects.get(user=user)
            if not verification.is_verified:
                return Response(
                    {"detail": "Please verify your email address before logging in. Check your inbox for the verification email."},
                    status=status.HTTP_403_FORBIDDEN
                )
        except models.EmailVerificationToken.DoesNotExist:
            # 古いユーザーアカウント（メール確認機能追加前）は許可
            pass

        token = RefreshToken.for_user(user)
        services.get_user_settings(user)
        return Response(
            {
                "access_token": str(token.access_token),
                "refresh_token": str(token),
                "expires_in": int(token.access_token.lifetime.total_seconds()),
                "anonymous": False,
            }
        )


class AuthRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return Response({"detail": "refresh_token is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
        except Exception as exc:  # pragma: no cover - token library exception
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        data = {
            "access_token": str(token.access_token),
            "refresh_token": str(token),
            "expires_in": int(token.access_token.lifetime.total_seconds()),
        }
        return Response(data)


class AuthAnonymousView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        device_id = request.data.get("device_id")
        anonymous_email = f"anon_{device_id or secrets.token_hex(4)}@example.com"
        user, created = User.objects.get_or_create(
            email=anonymous_email,
            defaults={"username": anonymous_email},
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        token = RefreshToken.for_user(user)
        services.get_user_settings(user)
        return Response(
            {
                "access_token": str(token.access_token),
                "refresh_token": str(token),
                "expires_in": int(token.access_token.lifetime.total_seconds()),
                "anonymous": True,
            }
        )


class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user

        # 匿名ユーザーは削除できない
        if user.email.startswith('anon_') and user.email.endswith('@example.com'):
            return Response(
                {"detail": "匿名アカウントは削除できません。"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ユーザーアカウントを削除（関連データは CASCADE で自動削除される）
        user_email = user.email
        user.delete()

        return Response(
            {"detail": f"アカウント {user_email} が正常に削除されました。"},
            status=status.HTTP_200_OK
        )


class MediaSignedUrlView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ttl = request.data.get("ttl")
        serializer = serializers.MediaSignedUrlSerializer(data=request.data, context={"ttl": ttl})
        serializer.is_valid(raise_exception=True)
        body = serializer.save()
        return Response(body)


class FavoritesListView(generics.ListAPIView):
    serializer_class = serializers.PhraseFeedSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = FeedPagination

    def get_queryset(self):
        from django.db.models import Exists, OuterRef, F, IntegerField
        from django.db.models.functions import Mod, Cast

        # Get random seed from query params
        seed_param = self.request.query_params.get('seed')
        if seed_param:
            try:
                seed = int(seed_param)
            except (ValueError, TypeError):
                seed = 1
        else:
            seed = 1

        # お気に入りのphraseのみを取得
        favorite_phrase_ids = (
            models.UserProgress.objects.filter(
                user=self.request.user,
                is_favorite=True,
                phrase__isnull=False,
            )
            .values_list("phrase_id", flat=True)
        )

        # Annotate is_mastered status
        mastered_subquery = models.UserProgress.objects.filter(
            user=self.request.user,
            phrase=OuterRef('pk'),
            is_mastered=True
        )

        # Pseudo-random ordering based on session seed for consistent pagination
        return (
            models.Phrase.objects.filter(id__in=favorite_phrase_ids)
            .prefetch_related("phraseexpression_set__expression")
            .annotate(
                is_mastered_by_user=Exists(mastered_subquery),
                random_order=Mod(
                    Cast(F('id') * (seed * 2654435761), IntegerField()),
                    1000000
                )
            )
            .order_by('is_mastered_by_user', 'random_order')
        )


class ProgressListView(generics.ListAPIView):
    serializer_class = serializers.UserProgressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    ordering = "-updated_at"

    def get_queryset(self):
        return (
            models.UserProgress.objects.filter(user=self.request.user)
            .select_related("phrase", "expression")
            .order_by("-updated_at")
        )


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"detail": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)

            # 既存の未使用トークンを無効化
            models.PasswordResetToken.objects.filter(
                user=user,
                is_used=False
            ).update(is_used=True)

            # 新しいトークンを作成
            reset_token = models.PasswordResetToken.objects.create(user=user)

            # リセットメールを送信
            try:
                services.send_password_reset_email(user, str(reset_token.token))
            except Exception as e:
                print(f"Failed to send password reset email: {e}")

            # セキュリティ上、ユーザーが存在するかどうかを明かさない
            return Response(
                {"message": "If an account with that email exists, a password reset link has been sent."},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            # セキュリティ上、同じメッセージを返す
            return Response(
                {"message": "If an account with that email exists, a password reset link has been sent."},
                status=status.HTTP_200_OK
            )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("token")
        new_password = request.data.get("new_password")

        if not token or not new_password:
            return Response(
                {"detail": "Token and new password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 6:
            return Response(
                {"detail": "Password must be at least 6 characters long"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            reset_token = models.PasswordResetToken.objects.get(token=token)

            if not reset_token.is_valid():
                return Response(
                    {"detail": "Password reset link has expired or been used. Please request a new one."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # パスワードを更新
            user = reset_token.user
            user.set_password(new_password)
            user.save(update_fields=["password"])

            # トークンを使用済みにする
            reset_token.mark_as_used()

            return Response(
                {"message": "Password has been reset successfully. You can now log in with your new password."},
                status=status.HTTP_200_OK
            )

        except models.PasswordResetToken.DoesNotExist:
            return Response(
                {"detail": "Invalid password reset link"},
                status=status.HTTP_400_BAD_REQUEST
            )


# Email redirect views (for opening app from email links)
from django.shortcuts import render
from django.conf import settings


def verify_email_redirect(request):
    """Redirect to app deep link for email verification"""
    token = request.GET.get('token', '')
    deep_link = f"{settings.APP_DEEP_LINK_SCHEME}://verify-email?token={token}"
    return render(request, 'app_redirect.html', {'deep_link': deep_link})


def reset_password_redirect(request):
    """Redirect to app deep link for password reset"""
    token = request.GET.get('token', '')
    deep_link = f"{settings.APP_DEEP_LINK_SCHEME}://reset-password?token={token}"
    return render(request, 'app_redirect.html', {'deep_link': deep_link})