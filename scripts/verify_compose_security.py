"""Render production compose using disposable sentinels, never a real env file."""
import json
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
env = {**os.environ, "DJANGO_SECRET_KEY": "sentinel-app-key-not-for-production-" * 3,
       "POSTGRES_PASSWORD": "sentinel-app-db", "POSTGRES_ADMIN_PASSWORD": "sentinel-admin-db",
       "MFA_ENCRYPTION_KEY": "a2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2s=",
       "BACKUP_ALERT_WEBHOOK": "sentinel-backup-hook", "APP_REVISION": "security-local"}
result = subprocess.check_output(["docker", "compose", "--profile", "tools", "-f", "docker-compose.pilot.yml", "-f", "docker-compose.kinghost.yml",
                                  "--env-file", os.devnull, "config", "--format", "json"], cwd=root, env=env)
config = json.loads(result)
for service in ("backend", "migrate"):
    values = config["services"][service]["environment"]
    assert "POSTGRES_ADMIN_PASSWORD" not in values and "BACKUP_ALERT_WEBHOOK" not in values
    assert "sentinel-admin-db" not in json.dumps(values)
    assert values["POSTGRES_PASSWORD"] == "sentinel-app-db"
assert config["services"]["db"]["environment"]["POSTGRES_PASSWORD"] == "sentinel-admin-db"
print("Effective compose: app/admin credentials separated; no backup secrets in backend/migrate.")
