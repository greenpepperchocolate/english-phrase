from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from phrases import views as phrases_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("phrases.urls")),
    # Email redirect endpoints (for opening app from email links)
    path("verify-email-redirect/", phrases_views.verify_email_redirect, name="verify_email_redirect"),
    path("reset-password-redirect/", phrases_views.reset_password_redirect, name="reset_password_redirect"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)