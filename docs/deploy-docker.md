# Deploy with Docker

## Prerequisites
- Docker Engine and Docker Compose
- Access to the SQL Server specified in `.env`
- Fill `.env` with DB and LDAP settings; secrets are injected at runtime

## Build and Run
```bash
docker compose build
docker compose up -d
```

## Containers
- web: Nginx serving the built frontend at `http://localhost:8080`
  - Proxies `/api` to `api:8083`
- api: Node Express backend at `http://localhost:8083`
  - Loads `.env` for DB/LDAP/JWT

## Configuration
- `.env` is mounted by Compose for backend
- CORS allows `http://localhost:8080` by default
- Frontend calls `/api/...`; Nginx proxies to backend

## Health Check
- Backend health: `GET http://localhost:8083/api/health`

## Common Commands
```bash
docker compose logs -f api
docker compose logs -f web
docker compose down
```

