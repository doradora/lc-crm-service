from rest_framework import serializers
from .models import Owner, Project, Quotation, Invoice, Category


class OwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Owner
        fields = "__all__"  # 包含所有欄位


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = "__all__"  # 包含所有欄位


class QuotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quotation
        fields = "__all__"  # 包含所有欄位


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = "__all__"  # 包含所有欄位


class CategorySerializer(serializers.ModelSerializer):
    projects_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = "__all__"  # 包含所有欄位
