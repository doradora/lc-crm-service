from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from rest_framework import viewsets
from .models import Owner, Project, Quotation, Invoice
from .serializers import (
    OwnerSerializer,
    ProjectSerializer,
    QuotationSerializer,
    InvoiceSerializer,
)


class OwnerViewSet(viewsets.ModelViewSet):
    queryset = Owner.objects.all()
    serializer_class = OwnerSerializer  # 業主資料的序列化器


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer  # 案件資料的序列化器


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.all()
    serializer_class = QuotationSerializer  # 報價單的序列化器


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer  # 請款單的序列化器


@login_required(login_url="signin")
def index(request):
    return render(request, "crm/index.html")
