#!/usr/bin/env bash
# Read-only. No credentials or environment values are emitted.
set -euo pipefail
sshd -t
sshd -T | awk '$1 ~ /^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|maxauthtries|pubkeyauthentication)$/ {print}'
ss -lnt '( sport = :22 or sport = :2812 )'
if command -v ufw >/dev/null; then ufw status verbose; fi
iptables -S INPUT
ip6tables -S INPUT
if systemctl is-active --quiet fail2ban; then echo 'fail2ban active'; else echo 'fail2ban inactive'; fi
