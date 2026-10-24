"""Django settings for the WeatherWise planner API."""
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "development-only-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "planner",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "planner.middleware.CorsMiddleware",
]
ROOT_URLCONF = "weatherwise.urls"
TEMPLATES = []
WSGI_APPLICATION = "weatherwise.wsgi.application"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django 5.2's Windows server formatter probes the user's Console registry to
# decide whether ANSI colours are available. Sandboxed terminals can deny that
# registry read, preventing `runserver` from starting at all. The API has no
# custom logging requirement, so skip Django's colour-aware default formatter.
LOGGING_CONFIG = None
