from django.core.management.base import BaseCommand
from crm.models import Owner


class Command(BaseCommand):
    help = "建立測試業主資料"

    def handle(self, *args, **options):
        # 測試業主資料
        test_owners = [
            {
                "company_name": "震旦企業股份有限公司",
                "tax_id": "12345678",
                "phone": "02-2545-5555",
                "fax": "02-2545-5556",
                "email": "contact@aurora.com.tw",
                "mobile": "0912-345-678",
                "address": "台北市信義區信義路5段7號",
                "contact_person": "王大明",
            },
            {
                "company_name": "廣達電腦股份有限公司",
                "tax_id": "23456789",
                "phone": "03-327-2345",
                "fax": "03-327-2346",
                "email": "info@quantatw.com",
                "mobile": "0922-333-444",
                "address": "桃園市龜山區文化二路211號",
                "contact_person": "李小華",
            },
            {
                "company_name": "台灣大哥大股份有限公司",
                "tax_id": "34567890",
                "phone": "02-6638-6888",
                "fax": "02-6638-6889",
                "email": "service@taiwanmobile.com",
                "mobile": "0910-123-456",
                "address": "台北市大安區敦化南路2段88號",
                "contact_person": "張美玲",
            },
            {
                "company_name": "宏碁股份有限公司",
                "tax_id": "45678901",
                "phone": "02-2696-1234",
                "fax": "02-2696-1235",
                "email": "service@acer.com.tw",
                "mobile": "0933-222-111",
                "address": "新北市汐止區新台五路一段88號",
                "contact_person": "陳建志",
            },
            {
                "company_name": "遠傳電信股份有限公司",
                "tax_id": "56789012",
                "phone": "02-8771-9000",
                "fax": "02-8771-9001",
                "email": "customer@fetvs.com.tw",
                "mobile": "0955-666-777",
                "address": "台北市內湖區內湖路一段388號",
                "contact_person": "林美珠",
            },
            {
                "company_name": "聯發科技股份有限公司",
                "tax_id": "67890123",
                "phone": "03-567-0766",
                "fax": "03-567-0767",
                "email": "info@mediatek.com",
                "mobile": "0977-888-999",
                "address": "新竹市科學園區篤行一路1號",
                "contact_person": "吳志明",
            },
            {
                "company_name": "台達電子工業股份有限公司",
                "tax_id": "78901234",
                "phone": "03-452-6107",
                "fax": "03-452-6108",
                "email": "service@delta.com.tw",
                "mobile": "0988-777-666",
                "address": "桃園市桃園區興隆路113號",
                "contact_person": "黃淑芬",
            },
            {
                "company_name": "統一企業股份有限公司",
                "tax_id": "89012345",
                "phone": "06-253-1101",
                "fax": "06-253-1102",
                "email": "contact@mail.pec.com.tw",
                "mobile": "0966-555-444",
                "address": "台南市永康區鹽行里中正路301號",
                "contact_person": "許志豪",
            },
            {
                "company_name": "富邦金融控股股份有限公司",
                "tax_id": "90123456",
                "phone": "02-6636-6636",
                "fax": "02-6636-6637",
                "email": "service@fubon.com",
                "mobile": "0933-111-222",
                "address": "台北市松山區敦化南路一段108號",
                "contact_person": "周雅婷",
            },
            {
                "company_name": "台灣積體電路製造股份有限公司",
                "tax_id": "01234567",
                "phone": "03-505-6688",
                "fax": "03-505-6689",
                "email": "contact@tsmc.com",
                "mobile": "0910-987-654",
                "address": "新竹科學園區力行六路8號",
                "contact_person": "楊正義",
            },
        ]

        # 建立業主資料
        self.stdout.write("開始建立測試業主資料...")
        created_count = 0

        for owner_data in test_owners:
            # 檢查是否已有相同統一編號的業主
            if Owner.objects.filter(tax_id=owner_data["tax_id"]).exists():
                self.stdout.write(
                    f"統一編號 {owner_data['tax_id']} 已存在，跳過建立業主 {owner_data['company_name']}"
                )
                continue

            # 建立業主
            owner = Owner.objects.create(**owner_data)
            created_count += 1
            self.stdout.write(
                f"已建立業主: {owner.company_name} (統編: {owner.tax_id}, 聯絡人: {owner.contact_person})"
            )

        self.stdout.write(
            self.style.SUCCESS(f"成功建立 {created_count} 筆測試業主資料")
        )
