from django.urls import path

from . import views

urlpatterns = [
    path("feed", views.PhraseFeedView.as_view(), name="feed"),
    path("phrase/<int:phrase_id>", views.PhraseDetailView.as_view(), name="phrase-detail"),
    path("favorites/toggle", views.FavoriteToggleView.as_view(), name="favorites-toggle"),
    path("mastered/toggle", views.MasteredToggleView.as_view(), name="mastered-toggle"),
    path("favorites", views.FavoritesListView.as_view(), name="favorites"),
    path("progress", views.ProgressListView.as_view(), name="progress"),
    path("logs/play", views.PlaybackLogCreateView.as_view(), name="logs-play"),
    path("settings", views.UserSettingsView.as_view(), name="user-settings"),
    path("media/signed-url", views.MediaSignedUrlView.as_view(), name="media-signed-url"),
    path("auth/signup", views.AuthSignUpView.as_view(), name="auth-signup"),
    path("auth/verify-email", views.EmailVerifyView.as_view(), name="auth-verify-email"),
    path("auth/login", views.AuthLoginView.as_view(), name="auth-login"),
    path("auth/refresh", views.AuthRefreshView.as_view(), name="auth-refresh"),
    path("auth/anonymous", views.AuthAnonymousView.as_view(), name="auth-anonymous"),
    path("auth/password-reset/request", views.PasswordResetRequestView.as_view(), name="auth-password-reset-request"),
    path("auth/password-reset/confirm", views.PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
]