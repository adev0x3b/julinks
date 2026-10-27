#!/usr/bin/env bash
# Starts a throwaway SeaweedFS container for a CI job and exports its S3 endpoint.
# A plain container rather than a `services:` entry: service containers cannot set a command,
# and the image needs `server -s3`. Random host port; `scripts/ci-seaweedfs.sh stop` removes it.
#
#   scripts/ci-seaweedfs.sh start <name>   writes S3_NAME and S3_TEST_ENDPOINT to $GITHUB_ENV
#   scripts/ci-seaweedfs.sh stop           removes the container named by $S3_NAME
set -euo pipefail

case "${1:-}" in
  start)
    name="${2:?container name}"
    docker rm -f "$name" >/dev/null 2>&1 || true
    docker run -d --name "$name" -p 127.0.0.1::8333 chrislusf/seaweedfs:4.48 server -s3 -dir=/data
    port=$(docker port "$name" 8333/tcp | head -1 | sed 's/.*://')
    for _ in $(seq 1 30); do
      curl -s -o /dev/null "http://127.0.0.1:$port/" && break
      sleep 2
    done
    echo "S3_NAME=$name" >> "$GITHUB_ENV"
    echo "S3_TEST_ENDPOINT=http://127.0.0.1:$port" >> "$GITHUB_ENV"
    ;;
  stop)
    docker rm -f "${S3_NAME:?}" >/dev/null 2>&1 || true
    ;;
  *)
    echo "usage: $0 start <name> | stop" >&2
    exit 2
    ;;
esac
