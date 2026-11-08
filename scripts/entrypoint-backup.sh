#!/bin/sh
set -e

echo "=== Khoi dong dich vu Tu dong Sao luu CSDL (Auto Backup) ==="
echo "Lich chay: 02:00 sang hang ngay (Giu trong vong ${KEEP_DAYS:-7} ngay, tu dong xoa ban dau tien khi vuot qua)"

# Chay 1 ban sao luu ngay khi khoi dong sau khi DB san sang
sleep 5
/bin/sh /backup.sh || echo "Ban sao luu khoi dong tam hoan, se chay theo lich cron."

# Thiet lap cron chay luc 02:00 sang moi ngay
echo "0 2 * * * /bin/sh /backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

crond -f -l 2