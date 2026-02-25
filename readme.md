# Firebase Auth and Cloud Run

## Overview
This is a sample configuration of a Firebase Auth setup with a Cloud Run service behind a load balancer. It demonstrates how to use Firebase Auth with a custom domain and a load balancer.

## Google Disclaimer
This is not an officially supported Google implementation

## Setup Environment
```bash
# Setup Environment variables
export PROJECT_ID=
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export NETWORK_NAME= #e.g. demo-network
export SUBNET_RANGE= #e.g. 10.128.0.0/20 
export REGION= #e.g. us-central1
export ZONE= #e.g. us-central1-c
export DOMAIN= #e.g. "example.com"
export SERVICE_NAME= #e.g. "cloud-run-service"
export NEG_NAME= #e.g. load-balancer-neg
export IP_NAME= #e.g. static-ip-name
export LB_NAME= #e.g. load-balancer-name

# Configure CLI
gcloud config set project $PROJECT_ID
gcloud config set billing/quota_project $PROJECT_ID

# Enable APIs
printf 'y' |  gcloud services enable cloudresourcemanager.googleapis.com --project $PROJECT_ID
printf 'y' |  gcloud services enable compute.googleapis.com --project $PROJECT_ID
printf 'y' |  gcloud services enable run.googleapis.com --project $PROJECT_ID
printf 'y' |  gcloud services enable vpcaccess.googleapis.com --project $PROJECT_ID
printf 'y' |  gcloud services enable identitytoolkit.googleapis.com --project $PROJECT_ID
printf 'y' |  gcloud services enable cloudbuild.googleapis.com --project $PROJECT_ID
printf 'y' |  gcloud services enable recaptchaenterprise.googleapis.com --project $PROJECT_ID

#Setup Network
gcloud compute networks create $NETWORK_NAME \
    --project=$PROJECT_ID \
    --subnet-mode=custom 
gcloud compute networks subnets create $NETWORK_NAME-subnet \
    --project=$PROJECT_ID \
    --network=$NETWORK_NAME \
    --range=$SUBNET_RANGE \
    --region=$REGION

#Setup NAT
gcloud compute routers create nat-router \
  --project=$PROJECT_ID \
  --network $NETWORK_NAME \
  --region $REGION
gcloud compute routers nats create nat-config \
  --router-region $REGION \
  --project=$PROJECT_ID \
  --router nat-router \
  --nat-all-subnet-ip-ranges \
  --auto-allocate-nat-external-ips
```
## Cloud Run and Load Balancing

### Create Cloud Run Build with VPC Connector
```bash

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder" \
  --condition="None"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin" \
  --condition="None"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/logging.logWriter" \
  --condition="None"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" \
  --condition="None"

gcloud compute networks vpc-access connectors create run-vpc-connector \
    --region=$REGION \
    --network=$NETWORK_NAME \
    --range=10.8.0.0/28

gcloud run deploy $SERVICE_NAME \
    --source . \
    --region=$REGION \
    --ingress=internal-and-cloud-load-balancing \
    --vpc-connector=run-vpc-connector \
    --no-default-url \
    --no-invoker-iam-check \
    --allow-unauthenticated
```

### Create Load Balancer and Serverless NEG Mapping
```bash
#Serverless NEG
gcloud compute network-endpoint-groups create $NEG_NAME \
    --region=$REGION \
    --network-endpoint-type=serverless \
    --cloud-run-service=$SERVICE_NAME

#Static IP
gcloud compute addresses create $IP_NAME \
    --ip-version=IPV4 \
    --global

#Backend Server
gcloud compute backend-services create ${LB_NAME}-backend \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --global

# Add the NEG to the Backend Service
gcloud compute backend-services add-backend ${LB_NAME}-backend \
    --global \
    --network-endpoint-group=$NEG_NAME \
    --network-endpoint-group-region=$REGION

#URL Maps
gcloud compute url-maps create ${LB_NAME}-url-map \
    --default-service=${LB_NAME}-backend

# Create HTTP Proxy (Assuming HTTP for this example)
gcloud compute target-http-proxies create ${LB_NAME}-http-proxy \
    --url-map=${LB_NAME}-url-map

#Forwarding Rule
gcloud compute forwarding-rules create ${LB_NAME}-forwarding-rule \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --network-tier=PREMIUM \
    --address=$IP_NAME \
    --global \
    --target-http-proxy=${LB_NAME}-http-proxy \
    --ports=80
```

### Add HTTPS Route and Managed Certificate
```bash
#Create Managed Certificate
gcloud compute ssl-certificates create ${LB_NAME}-cert \
    --domains=$DOMAIN \
    --global

#Add HTTPS Proxy
gcloud compute target-https-proxies create ${LB_NAME}-https-proxy \
    --url-map=${LB_NAME}-url-map \
    --ssl-certificates=${LB_NAME}-cert

#Create HTTPS Forwarding Rule
gcloud compute forwarding-rules create ${LB_NAME}-https-rule \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --network-tier=PREMIUM \
    --address=$IP_NAME \
    --global \
    --target-https-proxy=${LB_NAME}-https-proxy \
    --ports=443
```

## Firebase Auth Setup

### Firebase Console
1. Create a Firebase Project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable the following Sign-in providers in the Authentication section:
    *   **Google**
    *   **Email/Password** (Enable the **Email link (passwordless sign-in)** option)
    *   **Anonymous**
3. Add your domain to the list of authorized domains in the Authentication section of the Firebase Console.
4. Add a **Web App** to your Firebase project.
5. Copy the Firebase configuration object and paste it into `public/firebase-config.js`.
6. **Enable MFA**:
    *   Go to **Authentication** > **Settings** > **SMS Multi-Factor Authentication**.
    *   Enable the toggle for **SMS Multi-Factor Authentication**.
    *   (Note: MFA requires upgrading to **Firebase Authentication with Identity Platform**).

### Firebase & Cloud Run IAM Permissions
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/iam.serviceAccountTokenCreator"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/firebaseauth.admin"
```