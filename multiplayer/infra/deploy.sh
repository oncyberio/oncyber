#!/usr/bin/env bash
# One-command deploy: cross-build the Colyseus image for the VM (linux/amd64),
# push to Artifact Registry, then pull + restart it on the VM.
#
# Prereqs (see infra/README.md): gcloud authenticated, Docker running, the VM
# provisioned and the Artifact Registry repo created.
#
# Config via env (or a .env next to this script):
#   GCP_PROJECT   - gcloud project id
#   GCP_REGION    - e.g. us-central1
#   GCP_ZONE      - e.g. us-central1-a
#   VM_NAME       - e.g. mmo
#   AR_REPO       - Artifact Registry repo name (e.g. mmo)
#
# Usage:
#   infra/deploy.sh            # build + push + restart colyseus
#   infra/deploy.sh config     # also copy infra config (Caddyfile/coturn) + restart all
set -euo pipefail

cd "$(dirname "$0")/.."

[ -f infra/.env ] && set -a && . infra/.env && set +a

: "${GCP_PROJECT:?set GCP_PROJECT}"
: "${GCP_REGION:?set GCP_REGION}"
: "${GCP_ZONE:?set GCP_ZONE}"
: "${VM_NAME:?set VM_NAME}"
: "${AR_REPO:?set AR_REPO}"

IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${AR_REPO}/colyseus"
TAG="$(git rev-parse --short HEAD)"

# Pin the immutable SHA tag end-to-end (the VM .env is repointed to it below).
# We deliberately do NOT rely on a :latest tag — multi-tag buildx pushes have
# bitten us, and an immutable tag makes rollbacks trivial.
echo "==> building ${IMAGE}:${TAG} (linux/amd64)"
docker buildx build --platform linux/amd64 -t "${IMAGE}:${TAG}" --push .

echo "==> restarting on ${VM_NAME} (pinning ${TAG})"
# The VM authenticates to Artifact Registry with its own service account token
# (needs roles/artifactregistry.reader), so no key material leaves this box.
REMOTE='
  set -e
  cd /opt/mmo
  curl -s -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
    | sed -n "s/.*\"access_token\":\"\([^\"]*\)\".*/\1/p" \
    | sudo docker login -u oauth2accesstoken --password-stdin https://'"${GCP_REGION}"'-docker.pkg.dev
  sudo sed -i "s#\(COLYSEUS_IMAGE=.*/colyseus\):.*#\1:'"${TAG}"'#" .env
  sudo docker compose pull colyseus
  sudo docker compose up -d colyseus
'

if [ "${1:-}" = "config" ]; then
  echo "==> syncing infra config to ${VM_NAME}"
  gcloud compute scp --zone "${GCP_ZONE}" --recurse \
    infra/vm/Caddyfile infra/coturn "${VM_NAME}:/opt/mmo/infra-staged" || true
  REMOTE="${REMOTE}
  cp -r /opt/mmo/infra-staged/* /opt/mmo/ 2>/dev/null || true
  sudo docker compose up -d
  "
fi

gcloud compute ssh "${VM_NAME}" --zone "${GCP_ZONE}" --command "${REMOTE}"

echo "==> done: ${IMAGE}:${TAG}"
