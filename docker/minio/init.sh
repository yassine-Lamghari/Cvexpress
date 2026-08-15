#!/bin/sh
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing "local/$MINIO_BUCKET"
mc version enable "local/$MINIO_BUCKET"

mc admin user add local "$MINIO_APP_ACCESS_KEY" "$MINIO_APP_SECRET_KEY" 2>/dev/null || true
mc admin policy create local cvzzer-storage /cvzzer-policy.json
mc admin policy attach local cvzzer-storage --user "$MINIO_APP_ACCESS_KEY"

echo "MinIO bucket and application user are ready."

