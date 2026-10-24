"""Django settings for the WeatherWise planner API."""
from pathlib import Path
import os
from urllib.parse import parse_qs, unquote, urlparse
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=false.")
    SECRET_KEY = "local-development-key-not-for-production"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
if os.environ.get("VERCEL") == "1" and ".vercel.app" not in ALLOWED_HOSTS:
    # Covers production and preview Vercel hostnames without permitting other hosts.
    ALLOWED_HOSTS.append(".vercel.app")
CORS_ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in os.environ.get("DJANGO_CORS_ALLOWED_ORIGINS", "http://localhost:8090,http://127.0.0.1:8090").split(",")
    if origin.strip()
}

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
def database_config(url: str | None) -> dict:
    """Use managed Postgres in production while retaining zero-setup SQLite locally."""
    if not url:
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}
    parsed = urlparse(url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ImproperlyConfigured("DATABASE_URL must be a PostgreSQL connection URL.")
    options = {key: values[-1] for key, values in parse_qs(parsed.query).items() if key in {"sslmode", "connect_timeout", "application_name"}}
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed.path.lstrip("/")),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or 5432),
        "OPTIONS": options,
        # Serverless functions must not retain an unbounded database connection.
        "CONN_MAX_AGE": 0,
    }


# Vercel Marketplace integrations commonly inject POSTGRES_URL; DATABASE_URL
# remains supported so any managed PostgreSQL provider can be used directly.
DATABASES = {"default": database_config(os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL"))}
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
