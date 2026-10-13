# Security policy

## Reporting a vulnerability

Please report security problems privately, never in a public issue or pull request.

- Email **adrian@hirobius.com** with "Security" in the subject line.
- Say what you found, where (file, page or version) and how to reproduce it.
- Leave out real customer data, passwords and keys.

You'll get a reply confirming the report, updates until it's fixed, and credit once it's fixed if you want it.

## Scope

This repository and what it deploys. Client systems that Hirobius operates follow that client's own policy.

## Secrets

Keys and passwords are never committed. Repositories hold only the names of keys; the values live in a password manager and in each host's environment settings. If you find a secret in this repository, report it as above so it can be rotated.

## How we keep it safe

Hirobius runs the same security baseline on every repository: dependency alerts and security updates, secret scanning, two-step sign-in on every account, and client data kept on client-owned systems. A fleet check flags any repository that falls behind.
