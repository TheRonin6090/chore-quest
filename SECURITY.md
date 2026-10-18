# Security

## How Chore Quest is meant to run

Chore Quest is built for **one home network**. Run it on a machine inside your house and reach it from devices on the same Wi-Fi. It has no accounts or passwords, only PINs, so it is **not safe to put on the internet**.

- **Don't port-forward it** on your router, and don't put it behind a public reverse proxy or tunnel. If you want to check on it when you're away, use a VPN into your home network (WireGuard, Tailscale and the like).
- **PINs only stop sibling and accidental taps.** After 5 wrong tries a login is locked: kids for 30 seconds, the parent for 30 seconds and then twice as long each time, up to 15 minutes. That slows guessing down a lot, but anyone on your network could still get through a 4-digit PIN eventually. Use a 6-digit parent PIN, and keep guests on a guest network if your router has one.
- **Traffic is plain HTTP.** On a home network that's normal, but anyone on the same network could read the traffic. If you put HTTPS in front, set `SECURE_COOKIES=true`.

## What it does to protect your network

- **Nothing goes out.** The server and the iPad page make no requests to the internet: no CDNs, fonts, analytics or update checks. A build check rejects any external URL in the front end.
- **DNS rebinding is refused.** The server only answers requests addressed to an IP address or a local name (`localhost`, a name with no dot, `.local`, `.lan`, `.home.arpa`, `.internal` and similar). Without this, a website opened on any device in the house could point its own domain at the server's address and use that browser to talk to the app. If you reach the app by some other name, add it to `ALLOWED_HOSTS`.
- **Other sites can't drive it.** Request bodies must be JSON, the parent cookie is `HttpOnly` and `SameSite=Lax`, and pages can't be framed (`X-Frame-Options: DENY`).
- **Least privilege in Docker.** The container runs as an unprivileged user, can write only to `data/` (and temporary files), and its log files are capped in size.

## What it stores

The database in `data/` holds the kids' names, chore history, money totals and PIN hashes (bcrypt). Backups and exports contain the same, so keep them private: don't commit `data/` or your `household.json`. The `.gitignore` already leaves them out.

## Reporting a vulnerability

Please report security problems privately via **GitHub → Security → Report a vulnerability** on this repository, not in a public issue.
