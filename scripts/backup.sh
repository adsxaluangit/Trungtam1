#!/bin/sh
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backups"
BACKUP_FILE="${BACKUP_DIR}/edumaster_backup_${TIMESTAMP}.sql"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Bat dau sao luu co so du lieu: ${BACKUP_FILE}"

pg_dump \
  -h "${DATABASE_HOST:-postgres}" \
  -p "${DATABASE_PORT:-5432}" \
  -U "${DATABASE_USERNAME:-postgres}" \
  -d "${DATABASE_NAME:-edumaster}" \
  -F p \
  -f "${BACKUP_FILE}"

if [ -s "${BACKUP_FILE}" ]; then
  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] Sao luu thanh cong! Dung luong: ${SIZE}"
else
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] LOI: File sao luu rong hoac that bai!"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# 1. Xoa cac ban sao luu cu hon KEEP_DAYS ngay
find "${BACKUP_DIR}" -maxdepth 1 -name "edumaster_backup_*.sql" -type f -mtime +"${KEEP_DAYS}" -print -delete || true

# 2. Dam bao chi giu toi da KEEP_DAYS ban sao luu tu dong (xoa ban dau tien/cu nhat truoc)
COUNT=$(ls -1 "${BACKUP_DIR}"/edumaster_backup_*.sql 2>/dev/null | wc -l | tr -d ' ')
if [ "${COUNT}" -gt "${KEEP_DAYS}" ]; then
  REMOVE_COUNT=$((COUNT - KEEP_DAYS))
  ls -1tr "${BACKUP_DIR}"/edumaster_backup_*.sql | head -n "${REMOVE_COUNT}" | while read -r OLD_FILE; do
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] Da vuot qua ${KEEP_DAYS} ban luu -> Xoa ban dau tien (cu nhat): ${OLD_FILE}"
    rm -f "${OLD_FILE}"
  done
fi

REMAINING=$(ls -1 "${BACKUP_DIR}"/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Hoan tat! Tong so ban sao luu hien co: ${REMAINING} (Giu toi da ${KEEP_DAYS} ngay)"