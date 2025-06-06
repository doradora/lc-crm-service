from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import PaymentProject, Project
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=PaymentProject)
def set_project_invoiced_on_add(sender, instance, created, **kwargs):
    if created and instance.project:
        if not instance.project.is_invoiced:
            instance.project.is_invoiced = True
            instance.project.save(update_fields=["is_invoiced"])
            logger.info(f"[Project:{instance.project.id}] is_invoiced 設為 True (PaymentProject 新增，payment_id={instance.payment_id})")

@receiver(post_delete, sender=PaymentProject)
def unset_project_invoiced_on_remove(sender, instance, **kwargs):
    try:
        project = instance.project
    except Project.DoesNotExist:
        logger.warning(f"[PaymentProject:{instance.id}] 關聯的 Project 不存在，略過 is_invoiced 邏輯")
        return
    if project:
        has_payment = PaymentProject.objects.filter(project=project).exists()
        if not has_payment and project.is_invoiced:
            project.is_invoiced = False
            project.save(update_fields=["is_invoiced"])
            logger.info(f"[Project:{project.id}] is_invoiced 設為 False (PaymentProject 刪除，payment_id={instance.payment_id})")
