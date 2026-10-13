"""Offline guard for accidentally tracked environment/credential artifacts.

No file contents are printed. This supplements, rather than replaces, a full
credential scanner and provider-side key revocation.
"""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root).decode().split("\0")
patterns = [rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----", rb"\bAKIA[0-9A-Z]{16}\b"]
problems = []
for name in filter(None, files):
    path = root / name
    if not path.is_file():
        continue
    if ((path.name.startswith(".env") and not path.name.endswith(".example"))
            or path.suffix.lower() in {".p12", ".pfx", ".pem", ".key", ".dump"}):
        problems.append(name)
    if any(re.search(pattern, path.read_bytes()) for pattern in patterns):
        problems.append(name)
if problems:
    raise SystemExit("Potential credential artifacts: " + ", ".join(sorted(set(problems))))
print("Offline credential artifact guard passed; no contents or inventory sent externally.")
