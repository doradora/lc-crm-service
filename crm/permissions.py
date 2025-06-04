from rest_framework import permissions

class IsAdminOrCanRequestPayment(permissions.BasePermission):
    """
    自訂權限，允許管理員或具有請款人員的使用者存取。
    """
    message = "您沒有權限執行此操作。" # 可選，自訂錯誤訊息

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profile') or request.user.profile is None:
            return False
        return request.user.profile.is_admin or request.user.profile.can_request_payment
    
class IsAdmin(permissions.BasePermission):
    """
    自訂權限，允許管理員使用者存取。
    """
    message = "您沒有權限執行此操作。" # 可選，自訂錯誤訊息

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profile') or request.user.profile is None:
            return False
        return request.user.profile.is_admin
