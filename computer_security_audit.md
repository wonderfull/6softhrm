# Computer Security Audit Report

## 1. Executive Summary
- Environment audited: Local macOS developer workstation `Dynamite.local`.
- Overall risk level: High.
- Top issues:
  - Unnecessary remote-access tooling and incoming firewall allowances.
  - MySQL auto-start with MySQL X Protocol exposure on `*:33060` until restart.
  - Firewall stealth mode disabled.
  - Host and package patching behind current recommended versions.
  - Local secrets/config hygiene is uneven.

## 2. Scope and Assumptions
- Reviewed:
  - OS posture, user/groups, network interfaces, listening ports, firewall settings, launch agents/daemons, cron, local config directories, package state, and MySQL/Docker presence.
- Access available:
  - Local user-level shell access without `sudo`.
- Limitations:
  - Could not fully verify privileged service state such as Remote Login enablement.
  - Could not inspect MySQL internal auth/TLS settings without DB credentials.
  - Docker daemon was not reachable during the audit.

## 3. System Inventory
- OS:
  - macOS 26.2, Apple M2 Pro, arm64, 16 GB RAM.
  - FileVault on, SIP enabled, Activation Lock enabled.
- User posture:
  - Current user `kirankumarmanne`.
  - Member of `admin`, `com.apple.access_ssh`, `com.apple.access_screensharing`, and `com.apple.access_remote_ae`.
- Network:
  - LAN IPv4 `192.168.1.160`.
  - Global IPv6 present.
  - Tunnel-style `utun6` address `100.123.193.45`.
- Firewall:
  - Enabled.
  - Stealth mode off.
  - Incoming allow-list includes `AnyDesk`, `node`, `python3`, `sshd-keygen-wrapper`, `smbd`, Tailscale extension, and other Apple/system services.
- Startup/services:
  - User LaunchAgents include OpenClaw gateway, OpenClaw kanban, and Homebrew MySQL.
  - System daemons include Docker helper/vmnetd, ExpressVPN, AnyDesk, TeamViewer, Tunnelblick, Zoom daemon, Google/Microsoft helpers.
- Installed remote/admin tooling:
  - AnyDesk, TeamViewer, Chrome Remote Desktop, Tunnelblick, ExpressVPN, Docker helpers, Tailscale allowance.
- Database/runtime:
  - Homebrew MySQL 9.6.0 running.
  - Classic MySQL on `127.0.0.1:3306`.
  - MySQL X Protocol on `*:33060` until restart after config change.
- Patch state:
  - Pending macOS Tahoe 26.4.
  - Pending Xcode Command Line Tools 26.4.
  - 72 outdated Homebrew formulae and 2 outdated casks.

## 4. Findings

### Unnecessary remote-access footprint
- Severity: High
- Affected component: Workstation remote administration posture
- Evidence:
  - Installed launch items and firewall exceptions for AnyDesk, TeamViewer, Chrome Remote Desktop, Tunnelblick, Tailscale-related allowance, SSH wrapper, SMB, and other remote-capable services.
  - You confirmed these remote-access tools are not required.
- Why it matters:
  - Multiple remote access paths expand attack surface and update obligations.
- Impact:
  - Higher chance of unauthorized remote access or compromise through stale agents.
- Recommended remediation:
  - Remove or disable unused remote-access tools and then review firewall exceptions.
- Effort: Medium
- Confidence: High

### MySQL X Protocol exposed on wildcard interface
- Severity: High
- Affected component: Local MySQL service
- Evidence:
  - `mysqld` listens on `127.0.0.1:3306` and `*:33060`.
  - `/opt/homebrew/etc/my.cnf` now includes `mysqlx = 0`, but MySQL still needs a restart for the change to take effect.
- Why it matters:
  - An unnecessary database listener broadens local-network and tunnel-mediated exposure.
- Impact:
  - Potential remote reachability of the MySQL X Plugin service.
- Recommended remediation:
  - Restart MySQL and verify `33060` is gone.
- Effort: Low
- Confidence: High

### Firewall stealth mode disabled
- Severity: Medium
- Affected component: macOS firewall
- Evidence:
  - `socketfilterfw --getstealthmode` reported stealth mode off.
- Why it matters:
  - The host is easier to discover and enumerate on local or overlay networks.
- Impact:
  - Increased exposure to scanning and reconnaissance.
- Recommended remediation:
  - Enable stealth mode.
- Effort: Low
- Confidence: High

### Patch posture is behind current recommended versions
- Severity: Medium
- Affected component: Host OS and package ecosystem
- Evidence:
  - macOS 26.4 and CLT 26.4 are pending.
  - Homebrew reports 72 outdated formulae and 2 outdated casks.
- Why it matters:
  - Stale runtimes and helper apps increase exploitability on a development machine with admin tooling.
- Impact:
  - Greater chance of host compromise through known vulnerabilities.
- Recommended remediation:
  - Apply macOS/CLT updates and then update high-risk Homebrew packages.
- Effort: Medium
- Confidence: High

### Local secret-bearing config locations need tighter hygiene
- Severity: Medium
- Affected component: User config directories and LaunchAgents
- Evidence:
  - OpenClaw LaunchAgent stores a plaintext service token in environment variables.
  - `~/.docker` and its config files are more readable than they need to be.
  - `~/.ssh/.DS_Store` exists inside the SSH directory.
- Why it matters:
  - Local readable configs make post-compromise token harvesting easier.
- Impact:
  - Easier credential or token theft after local access.
- Recommended remediation:
  - Tighten permissions, remove unnecessary metadata files, and move service tokens to a more appropriate secret store where possible.
- Effort: Low
- Confidence: High

### Backup and recovery posture is not tested
- Severity: Medium
- Affected component: Endpoint resilience
- Evidence:
  - You confirmed backup and restore procedures are not tested.
- Why it matters:
  - Untested backups are not reliable controls against hardware failure, ransomware, or operator mistakes.
- Impact:
  - Recovery time and recovery success are uncertain.
- Recommended remediation:
  - Define and test workstation recovery and data backup procedures.
- Effort: Medium
- Confidence: High

## 5. Prioritized Remediation Plan

### Immediate
- Restart MySQL and confirm `*:33060` is gone.
- Remove or disable AnyDesk, TeamViewer, Chrome Remote Desktop, Tunnelblick, and any unused Tailscale/VPN remote path.
- Enable firewall stealth mode.

### This week
- Review and trim the firewall allow-list.
- Confirm whether Remote Login, SMB, and Screen Sharing are enabled; disable anything not needed.
- Tighten local permissions for `~/.docker` and clean up `~/.ssh/.DS_Store`.

### This month
- Apply macOS 26.4 and CLT 26.4.
- Upgrade high-risk Homebrew packages.
- Review whether MySQL should auto-start at login.

### This quarter
- Standardize a minimal approved remote-access stack.
- Document and test endpoint backup and recovery.

## 6. Manual Action Checklist
- [ ] Restart MySQL.
- [ ] Verify `lsof -nP -iTCP -sTCP:LISTEN | grep mysql` no longer shows `*:33060`.
- [ ] Remove unused remote-access tools.
- [ ] Enable firewall stealth mode.
- [ ] Review firewall exceptions.
- [ ] Confirm Remote Login/SMB/Screen Sharing status.
- [ ] Tighten `~/.docker` permissions.
- [ ] Remove `~/.ssh/.DS_Store`.
- [ ] Apply OS and CLT updates.
- [ ] Upgrade high-risk Homebrew packages.
- [ ] Decide whether MySQL should remain auto-started.
- [ ] Test backup and restore.

## 7. Commands / Evidence Sources
- `sw_vers`
- `uname -a`
- `id`
- `ifconfig -a`
- `lsof -nP -iTCP -sTCP:LISTEN`
- `socketfilterfw --getglobalstate`
- `socketfilterfw --getstealthmode`
- `socketfilterfw --listapps`
- `launchctl list`
- `launchctl print ...`
- `ls -la ~/Library/LaunchAgents /Library/LaunchAgents /Library/LaunchDaemons`
- `crontab -l`
- `brew outdated --verbose`
- `softwareupdate --list`
- `/opt/homebrew/etc/my.cnf`

## 8. Final Posture Summary
The workstation has good built-in Apple protections enabled, but it is carrying too many remote-access paths and too many allowed inbound exceptions for a machine that does not need them. After removing unused remote tooling, enabling stealth mode, applying updates, and restarting MySQL with X Plugin disabled, the host posture should improve materially.
