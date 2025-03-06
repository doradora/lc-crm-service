from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, index

router = DefaultRouter()
router.register(r"", UserViewSet)

urlpatterns = [
    path("", index, name="users_index"),
    path("api", include(router.urls)),
]
