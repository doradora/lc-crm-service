from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    """
    使用者檔案模型
    用於擴展 Django 內建的 User 模型，儲存額外的使用者資訊
    """
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='profile',
        verbose_name='使用者'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='姓名'
    )
    phone = models.CharField(
        max_length=20, 
        blank=True, 
        null=True,
        verbose_name='電話'
    )
    is_admin = models.BooleanField(
        default=False,
        verbose_name='管理員權限'
    )
    is_designer = models.BooleanField(
        default=False,
        verbose_name='設計師權限'
    )
    is_project_manager = models.BooleanField(
        default=False,
        verbose_name='專案管理權限'
    )
    can_request_payment = models.BooleanField(
        default=False,
        verbose_name='請款權限'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='建立時間'
    )

    class Meta:
        verbose_name = '使用者檔案'
        verbose_name_plural = '使用者檔案'

    def __str__(self):
        return f"{self.name} ({self.user.username})"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    當新使用者建立時，自動建立對應的使用者檔案
    """
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """
    確保使用者資料更新時，使用者檔案也同步更新
    """
    if not hasattr(instance, 'profile'):
        UserProfile.objects.create(user=instance)
    instance.profile.save()
