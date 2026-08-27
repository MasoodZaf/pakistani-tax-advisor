#!/usr/bin/env bash
#
# Cron wrapper around scripts/smoke.sh.
#
# The August 2026 outage was not expensive because it was hard to fix — it was
# a one-line env var. It was expensive because NOBODY WAS TOLD. Prod was dead
# for days while `docker ps` said "healthy". This script exists to close that
# gap and nothing else.
#
# Behaviour:
#   * runs the browser-path smoke test against each URL given
#   * emails ONLY on a state CHANGE (ok->fail, fail->ok), so a sustained outage
#     does not generate 288 emails a day
#   * re-nags every REMIND_HOURS while still broken, so a failure that is
#     ignored on day one does not go quiet on day two
#   * always appends a line to the log, so there is a history to read
#
# Install (as the deploy user, not root):
#   */5 * * * * /opt/tax-advisor/scripts/smoke-cron.sh >/dev/null 2>&1
#
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SMOKE="$HERE/smoke.sh"
ENV_FILE="${ENV_FILE:-/opt/tax-advisor/.env}"
STATE_DIR="${STATE_DIR:-/var/tmp/meratax-smoke}"
LOG="${LOG:-$STATE_DIR/smoke.log}"
ALERT_TO="${ALERT_TO:-mas.zaf@gmail.com}"
REMIND_HOURS="${REMIND_HOURS:-6}"
TARGETS=("$@")
if [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=("https://mera-tax.com" "https://staging.mera-tax.com")
fi

mkdir -p "$STATE_DIR"

# Credentials are read from the deployed .env at run time and never baked in
# here, so rotating the Resend key needs no change to this file.
read_env() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-; }
RESEND_KEY="$(read_env SMTP_PASS)"
MAIL_FROM="$(read_env SMTP_FROM)"
[ -n "$MAIL_FROM" ] || MAIL_FROM="support@mera-tax.com"

send_alert() {
  subject="$1"; body="$2"
  if [ -z "$RESEND_KEY" ]; then
    echo "$(date -Is) ALERT-UNSENT (no SMTP_PASS in $ENV_FILE): $subject" >> "$LOG"
    return
  fi
  payload=$(ALERT_TO="$ALERT_TO" MAIL_FROM="$MAIL_FROM" SUBJ="$subject" BODY="$body" python3 -c '
import json, os
print(json.dumps({
  "from": "MeraTax Monitor <%s>" % os.environ["MAIL_FROM"],
  "to": [os.environ["ALERT_TO"]],
  "subject": os.environ["SUBJ"],
  "text": os.environ["BODY"],
}))')
  code=$(curl -sS --max-time 20 -o /tmp/resend.out.$$ -w '%{http_code}' \
    -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_KEY" \
    -H 'Content-Type: application/json' \
    -d "$payload" 2>/dev/null)
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "$(date -Is) ALERT-SENT to $ALERT_TO: $subject" >> "$LOG"
  else
    echo "$(date -Is) ALERT-FAILED ($code) $(head -c 200 /tmp/resend.out.$$ 2>/dev/null): $subject" >> "$LOG"
  fi
  rm -f /tmp/resend.out.$$
}

for url in "${TARGETS[@]}"; do
  key=$(printf '%s' "$url" | sed -E 's#^https?://##; s#[^A-Za-z0-9.]#_#g')
  state_file="$STATE_DIR/$key.state"
  stamp_file="$STATE_DIR/$key.lastalert"

  output="$($SMOKE "$url" 2>&1)"; rc=$?
  # Strip ANSI colour so the log and any email stay readable.
  clean="$(printf '%s' "$output" | sed -E 's/\x1b\[[0-9;]*m//g')"
  prev="$(cat "$state_file" 2>/dev/null || echo unknown)"

  if [ "$rc" -eq 0 ]; then
    echo "$(date -Is) OK   $url" >> "$LOG"
    if [ "$prev" = "fail" ]; then
      send_alert "RECOVERED: $url is serving logins again" \
"$url passed the browser-path smoke test again at $(date -Is).

$clean"
      rm -f "$stamp_file"
    fi
    echo ok > "$state_file"
  else
    failed=$(printf '%s' "$clean" | grep -c '^  FAIL')
    echo "$(date -Is) FAIL $url ($failed checks)" >> "$LOG"

    should_alert=0
    [ "$prev" != "fail" ] && should_alert=1
    if [ -f "$stamp_file" ]; then
      last=$(cat "$stamp_file" 2>/dev/null || echo 0)
      now=$(date +%s)
      [ $(( (now - last) / 3600 )) -ge "$REMIND_HOURS" ] && should_alert=1
    fi

    if [ "$should_alert" -eq 1 ]; then
      send_alert "MeraTax DOWN: $url failed $failed smoke check(s)" \
"The browser-path smoke test failed at $(date -Is).

This test only asserts what a real browser experiences, so a failure here means
users cannot use the site — even if 'docker ps' says healthy.

$clean

Log: $LOG
Runbook: repo docs/RUNBOOK-login-outage.md"
      date +%s > "$stamp_file"
    fi
    echo fail > "$state_file"
  fi
done
