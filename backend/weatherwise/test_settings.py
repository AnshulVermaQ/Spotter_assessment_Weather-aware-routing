from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase
from .settings import database_config


class DatabaseConfigTests(SimpleTestCase):
    def test_uses_sqlite_without_a_database_url_for_local_development(self):
        self.assertEqual(database_config(None)["ENGINE"], "django.db.backends.sqlite3")

    def test_parses_managed_postgres_url_for_vercel(self):
        config = database_config("postgresql://user:pass@db.example.com:6543/weatherwise?sslmode=require")
        self.assertEqual(config["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(config["NAME"], "weatherwise")
        self.assertEqual(config["HOST"], "db.example.com")
        self.assertEqual(config["PORT"], "6543")
        self.assertEqual(config["OPTIONS"], {"sslmode": "require"})

    def test_rejects_non_postgres_production_url(self):
        with self.assertRaises(ImproperlyConfigured):
            database_config("mysql://user:pass@db.example.com/weatherwise")
