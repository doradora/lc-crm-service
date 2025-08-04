#-*- coding:utf-8 -*-
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': 'DATABASES_NAME',
        'USER': 'DATABASES_USER',
        'PASSWORD': 'DATABASES_PASSWORD',
        'HOST': '127.0.0.1',
        'PORT': '',
        'AUTOCOMMIT': True,
    },
}

SECRET_KEY = 'SECRET_KEY'

DEBUG = False

ALLOWED_HOSTS = ['127.0.0.1']