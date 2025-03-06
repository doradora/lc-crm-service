from django.urls import path, include
from .views import signin, logout_view
from django.contrib.auth import views as auth_views

urlpatterns = [
    path("", include("crm.urls")),  # 包含crm.urls),
    path("signin/", signin, name="signin"),
    path("logout/", logout_view, name="logout"),
    path("users/", include("users.urls")),
]
