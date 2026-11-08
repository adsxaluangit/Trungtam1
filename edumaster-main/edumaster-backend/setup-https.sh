#!/bin/bash
# =================================================================
# Script cai dat HTTPS bang DNS Challenge
# Khong can port 80 - chi can port 443
#
# Cach dung:
#   bash setup-https.sh your@email.com
# =================================================================

DOMAIN="ptnl.mic1.edu.vn"
EMAIL="${1:-admin@mic1.edu.vn}"

echo ""
echo "======================================================"
echo "  Cai dat HTTPS (DNS Challenge) cho $DOMAIN"
echo "  Email: $EMAIL"
echo "======================================================"
echo ""
echo "Phuong phap: DNS-01 Challenge"
echo "  - Khong can port 80"
echo "  - Chi can port 443 (dang trong)"
echo "  - Can them 1 TXT record vao DNS panel"
echo ""

# BUOC 1: Lay chung chi bang DNS Challenge
echo "======================================================"
echo " BUOC 1: Lay chung chi SSL"
echo "======================================================"
echo ""
echo "Tiep theo Certbot se hoi ban them TXT record vao DNS."
echo "Hay san sang mo DNS panel cua mic1.edu.vn."
echo ""
read -p "Nhan Enter de bat dau..."

docker compose run --rm certbot certonly \
  --manual \
  --preferred-challenges dns \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

if [ $? -ne 0 ]; then
    echo ""
    echo "THAT BAI! Kiem tra lai:"
    echo "  1. Da them TXT record dung chua?"
    echo "  2. Record da propagate chua? (doi 1-5 phut)"
    echo "  3. Kiem tra: nslookup -type=TXT _acme-challenge.$DOMAIN 8.8.8.8"
    exit 1
fi

echo ""
echo "OK! Lay cert thanh cong!"

# BUOC 2: Khoi dong nginx-proxy voi HTTPS
echo ""
echo "======================================================"
echo " BUOC 2: Khoi dong Nginx Proxy (HTTPS port 443)"
echo "======================================================"
docker compose up -d nginx-proxy

sleep 3

# BUOC 3: Khoi dong tat ca services
echo ""
echo "======================================================"
echo " BUOC 3: Khoi dong tat ca services"
echo "======================================================"
docker compose up -d

echo ""
echo "======================================================"
echo " HOAN THANH!"
echo ""
echo " Kiem tra HTTPS:"
echo "   curl -I https://$DOMAIN"
echo ""
echo " Xem thong tin cert:"
echo "   docker compose run --rm certbot certificates"
echo ""
echo " Xem len trinh duyet:"
echo "   https://$DOMAIN"
echo "======================================================"
echo ""

# BUOC 4: Huong dan renew
echo "======================================================"
echo " LUU Y: Tu dong Renew SSL"
echo "======================================================"
echo ""
echo "Chung chi het han sau 90 ngay."
echo "De tu dong gia han, them cronjob sau (crontab -e):"
echo ""
echo "  0 3 1 * * cd $(pwd) && docker compose run --rm certbot renew --quiet && docker compose restart nginx-proxy"
echo ""
echo "QUAN TRONG: Khi renew bang DNS Challenge, ban phai"
echo "  cap nhat TXT record moi trong DNS panel."
echo "  Nen dat lich nh ac: moi 80 ngay gia han 1 lan."
echo "======================================================"
