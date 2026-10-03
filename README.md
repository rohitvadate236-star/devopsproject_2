# AutoDrive

A starter automobile-parts shop with a React storefront, Express API, and PostgreSQL database. Docker Compose runs the complete application locally; Kubernetes manifests are in `k8s/`.

## Run locally with Docker Compose

Install Docker Desktop, open PowerShell in the project folder, then run:

```powershell
docker compose up --build
```

Open [http://localhost:8081](http://localhost:8081). The API readiness endpoint is available at [http://localhost:8081/api/health/ready](http://localhost:8081/api/health/ready).

Stop the services with `Ctrl+C`, then run `docker compose down`. To also delete the local database volume and its data, run `docker compose down -v`.

## Run locally without Docker

Requirements: Node.js 20 or newer and PostgreSQL 16. Create a database named `autodrive`, then initialize it with `database/init.sql`. In one terminal:

```powershell
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGDATABASE = "autodrive"
$env:PGUSER = "postgres"
$env:PGPASSWORD = "postgres"
cd backend
npm install
npm run dev
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to the backend.

## Kubernetes

The manifests create a namespace, PostgreSQL with persistent storage, the API, and the frontend. Build the images first from the repository root:

```powershell
docker build -t autodrive-api:latest .\backend
docker build -t autodrive-frontend:latest .\frontend
```

Make those images available to your cluster. For Minikube:

```powershell
minikube image load autodrive-api:latest
minikube image load autodrive-frontend:latest
```

Apply the manifests and wait for the deployments:

```powershell
kubectl apply -f .\k8s\
kubectl -n automobile-shop rollout status deployment/autodrive-db
kubectl -n automobile-shop rollout status deployment/autodrive-api
kubectl -n automobile-shop rollout status deployment/autodrive-frontend
```

Forward the frontend service and open it:

```powershell
kubectl -n automobile-shop port-forward service/autodrive-frontend 8081:80
```

Visit [http://localhost:8081](http://localhost:8081). The optional `k8s/ingress.yaml` can be applied after installing an Ingress controller and configuring DNS for `shop.local`.

The Kubernetes Secret contains **development-only** credentials so the sample works out of the box. Replace them with securely managed credentials before deploying anywhere shared or public. For production, also configure TLS, backups, resource limits, and an external secret manager.

## Project layout

```text
backend/       Express REST API and API container
database/      PostgreSQL schema and demo product seed data
frontend/      React + Vite storefront and Nginx container
k8s/           Kubernetes namespace, configuration, and workloads
compose.yaml   Local multi-container setup
```

## API

- `GET /api/health/live` — process liveness
- `GET /api/health/ready` — database readiness
- `GET /api/products` — list in-stock products
- `POST /api/orders` — validate and place an order, decrementing stock transactionally
