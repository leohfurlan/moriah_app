import os
import subprocess
import sys
from pathlib import Path


def test_production_rejects_example_secret():
    env = {**os.environ, "DJANGO_SECRET_KEY": "unsafe-dev-secret-key", "DJANGO_DEBUG": "false"}
    result = subprocess.run([sys.executable, "-c", "import config.settings"],
                            cwd=Path(__file__).resolve().parents[2], env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert "DJANGO_SECRET_KEY" in result.stderr
