# @yagura/worker

The Yagura watchtower process: polls tracked names/addresses every 10 minutes,
refreshes `name_state`, computes status transitions, and delivers alerts via
Telegram and email. Also hosts the Telegram bot.

**Status: placeholder.** Built in Phase 2 (DB + poller) and Phase 3 (notifiers).
