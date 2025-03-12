from rest_framework import serializers
from .models import Owner, Project, Quotation, Invoice, Category


class CategorySerializer(serializers.ModelSerializer):
    projects_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ["id", "code", "description", "projects_count"]


class OwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Owner
        fields = [
            "id",
            "company_name",
            "tax_id",
            "phone",
            "fax",
            "email",
            "mobile",
            "address",
            "contact_person",
        ]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = "__all__"


class QuotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quotation
        fields = "__all__"


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = "__all__"
