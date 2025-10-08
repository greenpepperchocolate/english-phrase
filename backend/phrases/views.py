from __future__ import annotations

import secrets

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, mixins, permissions, status
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from . import models, serializers, services

User = get_user_model()


class FeedPagination(CursorPagination):
    page_size = 20
    page_size_query_param = "limit"
    max_page_size = 100
    ordering = "-created_at"


class PhraseFeedView(generics.ListAPIView):
    serializer_class = serializers.PhraseFeedSerializer
    pagination_class = FeedPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        topic = self.request.query_params.get("topic")
        difficulty = self.request.query_params.get("difficulty")
        qs = models.Phrase.objects.prefetch_related("phraseexpression_set__expression")
        if topic:
            qs = qs.filter(topic__iexact=topic)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        return qs.order_by("-created_at")


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


class MediaSignedUrlView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ttl = request.data.get("ttl")
        serializer = serializers.MediaSignedUrlSerializer(data=request.data, context={"ttl": ttl})
        serializer.is_valid(raise_exception=True)
        body = serializer.save()
        return Response(body)


class FavoritesListView(generics.ListAPIView):
    serializer_class = serializers.UserProgressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    ordering = "-updated_at"

    def get_queryset(self):
        return (
            models.UserProgress.objects.filter(
                user=self.request.user,
                is_favorite=True,
            )
            .select_related("phrase", "expression")
            .order_by("-updated_at")
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