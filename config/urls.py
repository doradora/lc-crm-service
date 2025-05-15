from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from .views import signin, logout_view
from django.contrib.auth import views as auth_views

urlpatterns = [
    path("crm/", include("crm.urls")),  # 包含crm.urls),
    path("users/", include("users.urls")),
    path("signin/", signin, name="signin"),
    path("logout/", logout_view, name="logout"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
