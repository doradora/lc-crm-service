from django.contrib import admin
from .models import Owner, Project, Quotation, Invoice

admin.site.register(Owner)
admin.site.register(Project)
admin.site.register(Quotation)
admin.site.register(Invoice)
