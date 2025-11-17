#!/bin/bash

# 6soft HRM Deployment Script for Hostinger VPS
# This script automates the deployment process

set -e  # Exit on any error

echo "🚀 Starting 6soft HRM Deployment..."

## Configuration - EDIT THESE VALUES BEFORE RUNNING
## Get MySQL credentials from Hostinger hPanel → Databases
DOMAIN="hrm.yourdomain.com"
SERVER_IP="YOUR_SERVER_IP"
DB_NAME="your_database_name"  # e.g., u123456789_hrm
DB_USER="your_db_user"         # e.g., u123456789_hrm
DB_PASSWORD="your_db_password" # Use strong password from Hostinger

## SECURITY: JWT secret is auto-generated - DO NOT hardcode here
JWT_SECRET=$(openssl rand -base64 32)

# Paths
APP_DIR="/var/www/6softhrm"
WEB_ROOT="/var/www/$DOMAIN"

echo "📋 Configuration:"
echo "   Domain: $DOMAIN"
echo "   Server IP: $SERVER_IP"
echo "   App Directory: $APP_DIR"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

echo "📦 Step 1: Installing system dependencies..."
apt update
apt install -y curl git nginx certbot python3-certbot-nginx mysql-client

echo "📦 Step 2: Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
node --version
npm --version

echo "📦 Step 3: Installing PM2..."
npm install -g pm2

echo "📥 Step 4: Cloning repository..."
if [ -d "$APP_DIR" ]; then
    echo "   Directory exists, pulling latest changes..."
    cd $APP_DIR
    git pull origin change_to_mysql
else
    git clone https://github.com/wonderfull/6softhrm.git $APP_DIR
    cd $APP_DIR
    git checkout change_to_mysql
fi

echo "🔧 Step 5: Setting up backend..."
cd $APP_DIR/backend

# Install dependencies
npm install --production

# Generate secure JWT secret
GENERATED_JWT_SECRET=$(openssl rand -base64 32)

# Create .env file (NEVER commit this to Git!)
cat > .env <<EOF
PORT=4000
NODE_ENV=production
JWT_SECRET=$GENERATED_JWT_SECRET
DATABASE_URL="mysql://$DB_USER:$DB_PASSWORD@localhost:3306/$DB_NAME"
EOF

# Secure the .env file
chmod 600 .env

echo "   ✓ Created .env file (secured with chmod 600)"

# Build backend
npm run build
echo "   ✓ Built backend"

# Setup database
npx prisma generate
npx prisma migrate deploy
echo "   ✓ Database migrations applied"

# Seed database
npm run seed
echo "   ✓ Database seeded"

echo "🎨 Step 6: Building frontend..."
cd $APP_DIR/frontend
npm install
npm run build
echo "   ✓ Frontend built"

# Copy to web root
mkdir -p $WEB_ROOT
cp -r dist/* $WEB_ROOT/
chown -R www-data:www-data $WEB_ROOT
chmod -R 755 $WEB_ROOT
echo "   ✓ Frontend deployed to $WEB_ROOT"

echo "🚀 Step 7: Starting backend with PM2..."
cd $APP_DIR/backend
pm2 delete 6soft-hrm-backend 2>/dev/null || true
pm2 start npm --name "6soft-hrm-backend" -- start
pm2 save
pm2 startup systemd -u root --hp /root
echo "   ✓ Backend started"

echo "🌐 Step 8: Configuring Nginx..."
cat > /etc/nginx/sites-available/$DOMAIN <<'NGINXCONF'
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;

    root WEB_ROOT_PLACEHOLDER;
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
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    gzip on;
    gzip_types text/plain text/css text/javascript application/javascript application/json;
    
    client_max_body_size 10M;
    
    access_log /var/log/nginx/DOMAIN_PLACEHOLDER.access.log;
    error_log /var/log/nginx/DOMAIN_PLACEHOLDER.error.log;
}
NGINXCONF

# Replace placeholders
sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN|g" /etc/nginx/sites-available/$DOMAIN
sed -i "s|WEB_ROOT_PLACEHOLDER|$WEB_ROOT|g" /etc/nginx/sites-available/$DOMAIN

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
echo "   ✓ Nginx configured"

echo "🔒 Step 9: Setting up SSL certificate..."
echo "   Run this command manually after DNS propagation:"
echo "   certbot --nginx -d $DOMAIN"

echo "🔥 Step 10: Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "   ✓ Firewall configured"

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Update DNS A record: $DOMAIN → $SERVER_IP"
echo "   2. Wait for DNS propagation (5-30 minutes)"
echo "   3. Run: certbot --nginx -d $DOMAIN"
echo "   4. Visit: https://$DOMAIN"
echo "   5. Login with: admin@example.com / password123"
echo ""
echo "🔑 Default credentials:"
echo "   Admin: admin@example.com / password123"
echo "   Manager: manager@example.com / password123"
echo ""
echo "⚙️  Useful commands:"
echo "   pm2 list                           # List processes"
echo "   pm2 logs 6soft-hrm-backend         # View logs"
echo "   pm2 restart 6soft-hrm-backend      # Restart app"
echo "   nginx -t                           # Test nginx config"
echo "   systemctl reload nginx             # Reload nginx"
echo ""
