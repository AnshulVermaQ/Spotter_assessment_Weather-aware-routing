#!/usr/bin/env python
import os
import sys

# Django initializes command colour support before it loads project settings.
# In restricted Windows terminals its registry probe can raise PermissionError,
# which prevents even `runserver` from starting. ANSICON bypasses that probe.
if sys.platform == "win32":
    os.environ.setdefault("ANSICON", "1")

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "weatherwise.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
