#!/bin/bash
# ==============================================================================
# SIYATECH Production Deployment Script for Linux (Ubuntu/Debian)
# ==============================================================================
set -e

WEB_DIR="/var/www/html"
BACKUP_DIR="/var/www/html_backup_$(date +%Y%m%d_%H%M%S)"
REPO_DIR="/tmp/siyatech-deploy"
REPO_URL="https://github.com/SijomonEanas/siyatech-website.git"

echo "=== [1/5] Checking Dependencies (Git & Nginx) ==="
if ! command -v git &> /dev/null; then
    echo "Installing git..."
    sudo apt-get update && sudo apt-get install -y git
fi

if ! command -v nginx &> /dev/null; then
    echo "Nginx not found. Installing Nginx..."
    sudo apt-get update && sudo apt-get install -y nginx
fi

echo "=== [2/5] Fetching Latest Code from GitHub ==="
rm -rf "$REPO_DIR"
git clone --depth 1 "$REPO_URL" "$REPO_DIR"

echo "=== [3/5] Backing up Current Web Root ==="
if [ -d "$WEB_DIR" ] && [ "$(ls -A $WEB_DIR)" ]; then
    echo "Creating backup at $BACKUP_DIR..."
    sudo cp -r "$WEB_DIR" "$BACKUP_DIR"
fi

echo "=== [4/5] Deploying Files to $WEB_DIR ==="
sudo mkdir -p "$WEB_DIR"
sudo cp -r "$REPO_DIR"/* "$WEB_DIR"/
# Remove git files from web root for security
sudo rm -rf "$WEB_DIR"/.git "$WEB_DIR"/.gitignore "$REPO_DIR"

# Set optimal permissions for web server (Nginx / Apache)
echo "Setting file permissions..."
sudo chown -R www-data:www-data "$WEB_DIR"
sudo find "$WEB_DIR" -type d -exec chmod 755 {} \;
sudo find "$WEB_DIR" -type f -exec chmod 644 {} \;

echo "=== [5/5] Testing & Reloading Web Server ==="
sudo nginx -t
sudo systemctl reload nginx

echo "=========================================================="
echo "✓ SIYATECH Website successfully deployed to $WEB_DIR!"
echo "✓ Nginx reloaded and live."
echo "=========================================================="
