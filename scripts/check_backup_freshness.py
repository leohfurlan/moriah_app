"""Read-only local watchdog. Exit nonzero for absent, future or stale success.

Use scheduler exit status with the user's approved alert destination. No
outbound notification or sensitive contents are emitted by this command.
"""
import argparse
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("success_file", type=Path)
parser.add_argument("--max-hours", type=float, default=26)
args = parser.parse_args()
try:
    value = datetime.fromisoformat(args.success_file.read_text().strip().replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - value).total_seconds()
    assert 0 <= age <= args.max_hours * 3600
except (OSError, ValueError, TypeError, AssertionError):
    raise SystemExit("Backup absent, invalid or overdue.") from None
print("Backup freshness verified.")
