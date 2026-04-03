# Hostinger VPS Runbook

This runbook documents the actual deployment flow used for:

- `https://6soft.co.uk` -> main website from `wonderfull/6soft-visionary-web`
- `https://hrm.6soft.co.uk` -> HRM frontend from this repo
- `https://hrm.6soft.co.uk/api/*` -> HRM backend from this repo

It is written for a single Ubuntu VPS on Hostinger.

## Current server layout

- VPS IP: `82.180.154.149`
- VPS IPv6: `2a02:4780:f:c11c::1`
- HRM repo path: `/var/www/6softhrm`
- Main website repo path: `/var/www/6soft-visionary-web`
- Main website web root: `/var/www/6soft-main`
- HRM web root: `/var/www/hrm.6soft.co.uk`

## What is running

- `nginx`
- `pm2`
- `mysql-server`
- HRM backend under PM2 as `6soft-hrm-backend`

## DNS required in Hostinger

Create or update these records:

- `A` `@` -> `82.180.154.149`
- `A` `www` -> `82.180.154.149`
- `A` `hrm` -> `82.180.154.149`

Also remove old conflicting `AAAA` records, or update them to:

- `@` -> `2a02:4780:f:c11c::1`
- `www` -> `2a02:4780:f:c11c::1`
- `hrm` -> `2a02:4780:f:c11c::1`

SSL will fail until DNS points at this VPS.

## Initial VPS setup

```bash
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx mysql-client mysql-server
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

## Clone repositories

```bash
mkdir -p /var/www
cd /var/www

git clone https://github.com/wonderfull/6softhrm.git
cd /var/www/6softhrm
git checkout main

git clone https://github.com/wonderfull/6soft-visionary-web.git
```

## HRM backend setup

Generate secrets:

```bash
openssl rand -base64 32
openssl rand -base64 24
```

Create local MySQL database and user:

```bash
mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS hrm_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'hrm_user'@'localhost' IDENTIFIED BY 'REPLACE_DB_PASSWORD';
ALTER USER 'hrm_user'@'localhost' IDENTIFIED BY 'REPLACE_DB_PASSWORD';
GRANT ALL PRIVILEGES ON hrm_prod.* TO 'hrm_user'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Create `/var/www/6softhrm/backend/.env`:

```env
PORT=4000
NODE_ENV=production
JWT_SECRET=REPLACE_REAL_JWT_SECRET
DATABASE_URL="mysql://hrm_user:REPLACE_DB_PASSWORD@localhost:3306/hrm_prod"
FRONTEND_URL=https://hrm.6soft.co.uk
VERIFY_SMTP_ON_BOOT=false
```

Secure the file:

```bash
chmod 600 /var/www/6softhrm/backend/.env
```

Install and prepare backend:

```bash
cd /var/www/6softhrm/backend
npm install
```

Important: this repo currently needs Prisma 5 CLI on the server for schema compatibility.

```bash
npm install -D prisma@5.22.0
npx prisma generate
npx prisma migrate deploy
npm run seed
```

Start backend:

```bash
cd /var/www/6softhrm/backend
pm2 delete 6soft-hrm-backend || true
pm2 start dist/index.js --name 6soft-hrm-backend
pm2 save
pm2 startup systemd -u root --hp /root
```

Verify:

```bash
curl http://127.0.0.1:4000/api/health
```

Expected:

```json
{"ok":true}
```

Default seeded login:

- `admin@example.com / password123`

## HRM frontend setup

```bash
cd /var/www/6softhrm/frontend
npm install
npm run build

mkdir -p /var/www/hrm.6soft.co.uk
rm -rf /var/www/hrm.6soft.co.uk/*
cp -r dist/* /var/www/hrm.6soft.co.uk/
chown -R www-data:www-data /var/www/hrm.6soft.co.uk
chmod -R 755 /var/www/hrm.6soft.co.uk
```

## Main website setup

The main website repo is a Vite app.

There is a Linux case-sensitivity issue in the current repo state. Before build, patch:

```tsx
import About from "./pages/About";
import Contact from "./pages/contact";
```

Specifically, in `src/App.tsx` change:

- `./pages/about` -> `./pages/About`
- `./pages/Contact` -> `./pages/contact`

Then install and build:

```bash
cd /var/www/6soft-visionary-web
rm -rf node_modules package-lock.json
npm install
npm install -D @rollup/rollup-linux-x64-gnu
npm run build

mkdir -p /var/www/6soft-main
rm -rf /var/www/6soft-main/*
cp -r dist/* /var/www/6soft-main/
chown -R www-data:www-data /var/www/6soft-main
chmod -R 755 /var/www/6soft-main
```

Why the extra Rollup package is needed:

- the first server build failed because npm skipped an optional native Rollup dependency on Linux

## Nginx configuration

### `/etc/nginx/sites-available/hrm.6soft.co.uk`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name hrm.6soft.co.uk;

    root /var/www/hrm.6soft.co.uk;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    client_max_body_size 10M;
}
```

### `/etc/nginx/sites-available/6soft.co.uk`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 6soft.co.uk www.6soft.co.uk;

    root /var/www/6soft-main;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable sites:

```bash
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/hrm.6soft.co.uk /etc/nginx/sites-enabled/hrm.6soft.co.uk
ln -sf /etc/nginx/sites-available/6soft.co.uk /etc/nginx/sites-enabled/6soft.co.uk
nginx -t
systemctl reload nginx
```

## SSL

After DNS points to the VPS:

```bash
certbot --nginx -d 6soft.co.uk -d www.6soft.co.uk -d hrm.6soft.co.uk
```

## Verification commands

Backend direct:

```bash
curl http://127.0.0.1:4000/api/health
```

HRM through Nginx:

```bash
curl -H 'Host: hrm.6soft.co.uk' http://127.0.0.1/api/health
```

Main site through Nginx:

```bash
curl -I -H 'Host: 6soft.co.uk' http://127.0.0.1
```

HRM login smoke test:

```bash
curl -H 'Host: hrm.6soft.co.uk' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}' \
  http://127.0.0.1/api/auth/login
```

## Update workflow

### HRM

```bash
cd /var/www/6softhrm
git pull origin main

cd backend
npm install
npx prisma generate
npx prisma migrate deploy
pm2 restart 6soft-hrm-backend

cd ../frontend
npm install
npm run build
rm -rf /var/www/hrm.6soft.co.uk/*
cp -r dist/* /var/www/hrm.6soft.co.uk/
chown -R www-data:www-data /var/www/hrm.6soft.co.uk
```

### Main website

```bash
cd /var/www/6soft-visionary-web
git pull origin main
npm install
npm install -D @rollup/rollup-linux-x64-gnu
npm run build
rm -rf /var/www/6soft-main/*
cp -r dist/* /var/www/6soft-main/
chown -R www-data:www-data /var/www/6soft-main
```

## Automatic deployment options

### Option 1: GitHub Actions

This repo includes:

- `.github/workflows/deploy-vps.yml`
- `scripts/deploy-vps.sh`

To use it, add these GitHub secrets in the HRM repository:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

Then each push to `main` will SSH into the VPS and run:

```bash
bash /var/www/6softhrm/scripts/deploy-vps.sh
```

### Option 2: VPS pull-based deployment

This repo also includes:

- `scripts/check-and-deploy.sh`

It checks both repositories on the VPS and only deploys when `origin/main` changed.

Example cron entry on the VPS:

```cron
*/5 * * * * /var/www/6softhrm/scripts/check-and-deploy.sh
```

Install it with:

```bash
chmod +x /var/www/6softhrm/scripts/deploy-vps.sh
chmod +x /var/www/6softhrm/scripts/check-and-deploy.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/6softhrm/scripts/check-and-deploy.sh") | crontab -
```

Recommended rollout:

1. Commit and push the repo fixes first.
2. Pull latest on the VPS once.
3. Then enable the cron entry or GitHub Actions.

## Known repo issues discovered during deployment

### HRM repo

- deployment references must use `main`
- backend TypeScript build currently fails on production server with implicit `any` errors, so the server is relying on the committed `dist/` output rather than a fresh successful backend compile
- Prisma CLI v7 is incompatible with the current schema config; server must use Prisma 5 CLI unless the repo is upgraded properly

### 6soft website repo

- current `main` branch contains case-mismatched imports that fail on Linux
- current server build needed `@rollup/rollup-linux-x64-gnu` installed explicitly

## Important files on the server

- HRM secrets copy: `/root/hrm-secrets.txt`
- HRM backend env: `/var/www/6softhrm/backend/.env`
- Nginx site file: `/etc/nginx/sites-available/hrm.6soft.co.uk`
- Nginx site file: `/etc/nginx/sites-available/6soft.co.uk`
