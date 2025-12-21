# Backend

Docker Deployment

- Build and run
  - `docker compose build`
  - `docker compose up -d`
- API
  - Health: `http://localhost:8083/api/health`
  - CORS is configured to allow `http://localhost:8080`
- Environment
  - `.env` in repo root is loaded by the backend container
  - Required: `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`
  - Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`
  - LDAP: `LDAP_URL`, `LDAP_BASE_DN`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_GROUP_*`
- Notes
  - Domain users are auto-provisioned on successful AD login
  - Local users can be created from the UI
