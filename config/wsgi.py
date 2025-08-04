"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/wsgi/
"""

import os, sys, site
import platform

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CONF_PATH = os.path.abspath(os.path.join(BASE_DIR, 'config'))
CRM_PATH = os.path.abspath(os.path.join(BASE_DIR, 'crm'))
USER_PATH = os.path.abspath(os.path.join(BASE_DIR, 'users'))


u"""
指向 virtualenv 環境。
=======================
"""
ALLDIRS = [os.path.join(BASE_DIR, '..', 'Lib', 'site-packages')]
prev_sys_path, new_sys_path = list(sys.path), []

for directory in ALLDIRS:
    site.addsitedir(directory)

for item in list(sys.path):
    if item not in prev_sys_path:
        new_sys_path.append(item)
        sys.path.remove(item)

sys.path[:0] = new_sys_path


u"""
將附屬資料夾加入系統路徑。
=======================
"""
sys.path.extend([BASE_DIR])
sys.path.extend([CONF_PATH])
sys.path.extend([CRM_PATH])
sys.path.extend([USER_PATH])

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')


u"""
啟動 virtualenv 環境。
=======================
"""

if platform.system() == 'Windows':
    try:
        activate_env = os.path.expanduser(os.path.join(BASE_DIR, '..', 'Scripts', 'activate_this.py'))
        exec(compile(open(activate_env, "rb").read(), activate_env, 'exec'), dict(__file__=activate_env))
    except: pass
else:
    try:
        activate_env = os.path.expanduser(os.path.join(BASE_DIR, '..', 'bin', 'activate_this.py'))
        exec(compile(open(activate_env, "rb").read(), activate_env, 'exec'), dict(__file__=activate_env))
    except: pass


from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()