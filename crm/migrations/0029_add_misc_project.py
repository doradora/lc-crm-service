from django.db import migrations


def create_misc_project(apps, schema_editor):
    """
    新增「其他」專案，用於記錄雜費等不屬於特定專案的費用
    """
    Project = apps.get_model('crm', 'Project')
    Owner = apps.get_model('crm', 'Owner')
    Category = apps.get_model('crm', 'Category')
    
    # 創建「其他」類別（code = 'OTHER'）
    category = Category.objects.create(
        code='OTHER',
		description='其他'
	)
    
    # 創建一個系統業主
    owner = Owner.objects.create(
        company_name='系統',
        tax_id='00000000',
        phone='000-0000-0000',
        address='系統內建',
        contact_person='系統管理員'
    )
    
    # 檢查是否已存在「其他」專案
    misc_project_exists = Project.objects.filter(
        name='其他',
        category=category
    ).exists()
    
    if not misc_project_exists:
        # 創建「其他」專案
        Project.objects.create(
            owner=owner,
            year=2099,  # 使用當前年份
            project_number='9999',  # 使用特殊編號 9999
            name='其他',
            report_name='雜費項目',
            contact_info='系統內建項目',
            notes='此專案用於記錄發票中的雜費項目，如影印費、郵資費等不屬於特定專案的費用。',
            is_completed=False,
            category=category,
            total_expenditure=0,
            is_invoiced=False,
            is_paid=False,
            custom_fields={}
        )


def add_misc_project_to_existing_payments(apps, schema_editor):
    """
    將「其他」專案新增到既有的請款單中
    """
    Project = apps.get_model('crm', 'Project')
    Payment = apps.get_model('crm', 'Payment')
    PaymentProject = apps.get_model('crm', 'PaymentProject')
    Category = apps.get_model('crm', 'Category')
    
    try:
        # 取得「其他」專案
        category = Category.objects.get(code='OTHER')
        misc_project = Project.objects.get(
            name='其他',
            category=category,
            project_number='9999'
        )
        
        # 取得所有既有的請款單
        existing_payments = Payment.objects.all()
        
        created_count = 0
        for payment in existing_payments:
            # 檢查該請款單是否已經有「其他」專案
            existing_misc = PaymentProject.objects.filter(
                payment=payment,
                project=misc_project
            ).exists()
            
            if not existing_misc:
                # 新增「其他」專案到請款單中，預設金額為 0
                PaymentProject.objects.create(
                    payment=payment,
                    project=misc_project,
                    amount=0,
                    description='雜費項目（影印費、郵資費等）'
                )
                created_count += 1
        
        print(f"成功將「其他」專案新增到 {created_count} 個既有請款單中")
        
    except (Category.DoesNotExist, Project.DoesNotExist):
        print("找不到「其他」專案，跳過新增到既有請款單的操作")


def remove_misc_project_from_payments(apps, schema_editor):
    """
    從所有請款單中移除「其他」專案
    """
    Project = apps.get_model('crm', 'Project')
    PaymentProject = apps.get_model('crm', 'PaymentProject')
    Category = apps.get_model('crm', 'Category')
    
    try:
        category = Category.objects.get(code='OTHER')
        misc_project = Project.objects.get(
            name='其他',
            category=category,
            project_number='9999'
        )
        
        # 移除所有包含「其他」專案的 PaymentProject 記錄
        deleted_count = PaymentProject.objects.filter(project=misc_project).count()
        PaymentProject.objects.filter(project=misc_project).delete()
        
        print(f"成功從 {deleted_count} 個請款單中移除「其他」專案")
        
    except (Category.DoesNotExist, Project.DoesNotExist):
        print("找不到「其他」專案，跳過移除操作")


def reverse_misc_project(apps, schema_editor):
    """
    移除「其他」專案
    """
    # 先從所有請款單中移除「其他」專案
    remove_misc_project_from_payments(apps, schema_editor)
    
    Project = apps.get_model('crm', 'Project')
    Category = apps.get_model('crm', 'Category')
    Owner = apps.get_model('crm', 'Owner')
    
    try:
        # 移除「其他」專案
        category = Category.objects.get(code='OTHER')
        Project.objects.filter(
            name='其他',
            category=category,
            project_number='9999'
        ).delete()
        
        # 移除系統業主（如果沒有其他專案使用的話）
        system_owner = Owner.objects.filter(
            company_name='系統',
            tax_id='00000000'
        ).first()
        if system_owner and not system_owner.project_set.exists():
            system_owner.delete()
            
        # 移除「其他」類別（如果沒有其他專案使用的話）
        if not category.project_set.exists():
            category.delete()
            
    except Category.DoesNotExist:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0028_alter_owner_email'),
    ]

    operations = [
        # 第一步：創建「其他」專案
        migrations.RunPython(
            create_misc_project,
            reverse_code=reverse_misc_project,
            atomic=True
        ),
        # 第二步：將「其他」專案新增到既有請款單中
        migrations.RunPython(
            add_misc_project_to_existing_payments,
            reverse_code=remove_misc_project_from_payments,
            atomic=True
        ),
    ]
