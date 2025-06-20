from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, index, profile, user_projects, ImpersonateView

router = DefaultRouter()
router.register(r"", UserViewSet)

urlpatterns = [
    path("", index, name="users_index"),
    path("profile/", profile, name="user_profile"),
    path("<int:user_id>/projects/", user_projects, name="user_projects"),
    path("api/impersonate/", ImpersonateView.as_view(), name="impersonate_user"),
    path("api/", include(router.urls)),
]
