#!/usr/bin/env bash
# One-time GCP provisioning: static IP, free-tier e2-micro (Debian 12),
# firewall rules, Artifact Registry repo, and Docker + swap on the VM.
# Idempotent-ish: re-running skips resources that already exist.
#
# Prereqs: gcloud authenticated (`gcloud auth login`), billing enabled.
# Config: infra/.env (see infra/env.deploy.example).
set -euo pipefail

cd "$(dirname "$0")"

[ -f .env ] && set -a && . .env && set +a

: "${GCP_PROJECT:?set GCP_PROJECT}"
: "${GCP_REGION:?set GCP_REGION}"     # free tier: us-central1 / us-west1 / us-east1
: "${GCP_ZONE:?set GCP_ZONE}"
: "${VM_NAME:?set VM_NAME}"
: "${AR_REPO:?set AR_REPO}"

gcloud config set project "${GCP_PROJECT}"

echo "==> enabling APIs"
gcloud services enable compute.googleapis.com artifactregistry.googleapis.com

echo "==> static IP"
gcloud compute addresses create "${VM_NAME}-ip" --region "${GCP_REGION}" 2>/dev/null \
  || echo "   (exists)"
IP=$(gcloud compute addresses describe "${VM_NAME}-ip" --region "${GCP_REGION}" --format='value(address)')
echo "   ${IP}  <-- point your DNS A record here"

echo "==> Artifact Registry repo"
gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker --location "${GCP_REGION}" 2>/dev/null || echo "   (exists)"

echo "==> firewall"
gcloud compute firewall-rules create "${VM_NAME}-web" --target-tags="${VM_NAME}" \
  --allow=tcp:80,tcp:443,tcp:3478 2>/dev/null || echo "   (web exists)"
gcloud compute firewall-rules create "${VM_NAME}-turn" --target-tags="${VM_NAME}" \
  --allow=udp:3478,udp:49152-65535 2>/dev/null || echo "   (turn exists)"

echo "==> VM (e2-micro, pd-standard = free tier)"
if ! gcloud compute instances describe "${VM_NAME}" --zone "${GCP_ZONE}" >/dev/null 2>&1; then
  gcloud compute instances create "${VM_NAME}" \
    --zone "${GCP_ZONE}" --machine-type=e2-micro \
    --image-family=debian-12 --image-project=debian-cloud \
    --boot-disk-type=pd-standard --boot-disk-size=30GB \
    --address="${VM_NAME}-ip" --tags="${VM_NAME}" \
    --scopes=https://www.googleapis.com/auth/cloud-platform
else
  echo "   (exists)"
fi

# Grant the VM service account pull access to Artifact Registry.
SA=$(gcloud compute instances describe "${VM_NAME}" --zone "${GCP_ZONE}" \
  --format='value(serviceAccounts[0].email)')
gcloud artifacts repositories add-iam-policy-binding "${AR_REPO}" \
  --location "${GCP_REGION}" --member "serviceAccount:${SA}" \
  --role roles/artifactregistry.reader >/dev/null 2>&1 || true

echo "==> installing docker + swap on the VM"
gcloud compute ssh "${VM_NAME}" --zone "${GCP_ZONE}" --command '
  set -e
  if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
  fi
  if [ ! -f /swapfile ]; then
    sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
    sudo mkswap /swapfile && sudo swapon /swapfile
    echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
  fi
  echo "{\"log-driver\":\"json-file\",\"log-opts\":{\"max-size\":\"10m\",\"max-file\":\"3\"}}" \
    | sudo tee /etc/docker/daemon.json >/dev/null
  sudo systemctl restart docker
  sudo mkdir -p /opt/mmo && sudo chown "$USER" /opt/mmo
'

echo ""
echo "Next:"
echo "  1. Create DNS A record: <your-domain> -> ${IP}  (TTL 300)"
echo "  2. Put infra/vm/Caddyfile (with that domain), docker-compose.yml,"
echo "     coturn/, and a filled-in vm/env onto /opt/mmo on the VM"
echo "     (gcloud compute scp --recurse infra/vm infra/coturn ${VM_NAME}:/opt/mmo)"
echo "  3. infra/deploy.sh      # build+push+start the colyseus image"
echo "  4. On the VM: cd /opt/mmo && docker compose up -d   # first full bring-up"
