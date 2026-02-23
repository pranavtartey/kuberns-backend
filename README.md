# Kuberns Backend

NestJS backend service that accepts web app deployment requests, stores deployment metadata in PostgreSQL, and processes provisioning jobs with Bull (Redis).

## What This Service Does

- Exposes REST APIs for creating and querying web app deployments.
- Validates and persists app + environment + instance configuration.
- Encrypts environment variable values before storing them.
- Queues deployment work on Redis-backed Bull queue.
- Simulates deployment stages and provisions EC2 instances (or mocked instances) at the final stage.
- Publishes Swagger docs for easy API exploration.

## Tech Stack

- NestJS 11
- TypeORM 0.3 + PostgreSQL
- Bull 4 + Redis
- AWS SDK v3 (EC2, ECS, RDS)
- class-validator + class-transformer

## High-Level Request Flow

```mermaid
flowchart TD
  A[Frontend POST /webapps] --> B[WebAppsController]
  B --> C[ValidationPipe DTO validation]
  C --> D[WebAppsService.create transaction]
  D --> E["PostgreSQL\nwebapps / environments / instances"]
  D --> F[Encrypt env var values]
  D --> G[Queue job deployment:simulate]
  G --> H[Bull Queue on Redis]
  H --> I[DeploymentProcessor]
  I --> J[Update status + write deployment logs]
  I --> K[AwsProvisionerService.provisionEc2Instance]
  K --> L[(AWS EC2)]
  I --> M[GET /webapps/:id/status]
```

## End-to-End Deployment Pipeline

1. `POST /webapps` receives `CreateWebAppDto` payload.
2. Global `ValidationPipe` (`whitelist + transform`) validates and strips unknown fields.
3. `WebAppsService.create` runs a DB transaction:
   - Creates `webapps` row.
   - Creates one or more `environments` rows.
   - Encrypts every `envVariables[].value` before insert.
   - Creates instance rows (defaults applied when values missing).
4. Service pushes `{ webappId }` to Bull queue `deployment` with job name `simulate`.
5. `DeploymentProcessor` consumes the job and runs deployment stages:
   - `pending -> deploying -> active` updates on webapp + instance.
   - Appends deployment logs per stage.
   - On `active`, provisions EC2 instance if not already provisioned.
6. `AwsProvisionerService` selects target region from `webapp.region`, launches EC2, waits for `running`, logs IP details with Nest logger.

## API Surface

Base URL: `http://localhost:<PORT>`

Swagger: `GET /api/docs`

### WebApps

- `POST /webapps` - Create a web app deployment request.
- `GET /webapps` - List all web apps for the dummy user (`id=1`).
- `GET /webapps/:id` - Get full web app details.
- `GET /webapps/:id/status` - Poll deployment status + recent logs.

> Current implementation uses a seeded dummy owner (`DUMMY_USER_ID = 1`) in controller.

## Request Contract (`POST /webapps`)

```json
{
  "name": "kuberns-from-frontend",
  "region": "us-east-1",
  "framework": "express",
  "plan": "pro",
  "orgId": "org-1",
  "repoId": "repo-1",
  "branch": "dev",
  "environments": [
    {
      "branch": "dev",
      "assignRandomPort": true,
      "envVariables": [
        {
          "key": "some_key",
          "value": "sjdbfsidbfiawuesdbfiusdbr12345wdsderg"
        }
      ],
      "instances": [{}]
    }
  ]
}
```

### Enum Values

- `region`: `ap-south-1 | us-east-1 | us-west-2 | eu-west-1`
- `framework`: `react | nextjs | express | nestjs | vue`
- `plan`: `starter | pro`

## Database Model

All tables extend a common base with:
- `id`
- `created_by`, `updated_by`
- `created_at`, `updated_at`, `deleted_at`

### ER Diagram

```mermaid
erDiagram
  USERS ||--o{ WEBAPPS : owns
  WEBAPPS ||--o{ ENVIRONMENTS : has
  ENVIRONMENTS ||--o{ INSTANCES : has
  INSTANCES ||--o{ DEPLOYMENT_LOGS : emits
  WEBAPPS ||--o| DATABASE_CONFIGS : optionally_has

  USERS {
    int id PK
    varchar email UK
    varchar password
    varchar first_name
    varchar last_name
    datetime created_at
    datetime updated_at
    datetime deleted_at
  }

  WEBAPPS {
    int id PK
    int owner_id FK
    varchar name
    varchar region
    varchar framework
    enum plan
    varchar org_id
    varchar repo_id
    varchar branch
    enum status
    timestamptz status_updated_at
    datetime created_at
    datetime updated_at
    datetime deleted_at
  }

  ENVIRONMENTS {
    int id PK
    int webapp_id FK
    varchar branch
    int port
    boolean assign_random_port
    jsonb env_variables
    datetime created_at
    datetime updated_at
    datetime deleted_at
  }

  INSTANCES {
    int id PK
    int environment_id FK
    varchar cpu
    varchar ram
    varchar storage
    enum status
    timestamptz status_updated_at
    varchar aws_task_arn
    varchar aws_instance_id
    datetime created_at
    datetime updated_at
    datetime deleted_at
  }

  DEPLOYMENT_LOGS {
    int id PK
    int instance_id FK
    varchar status
    text message
    datetime logged_at
    datetime created_at
    datetime updated_at
    datetime deleted_at
  }

  DATABASE_CONFIGS {
    int id PK
    int webapp_id FK
    enum db_type
    varchar host
    int port
    varchar db_name
    varchar username
    varchar password
    datetime created_at
    datetime updated_at
    datetime deleted_at
  }
```

## AWS Provisioning Behavior

- If `AWS_MOCK_MODE=true` (default), no real AWS call is made.
- If `AWS_MOCK_MODE=false`, backend launches EC2 in selected `webapp.region`.
- Region-specific overrides are supported with env var suffixes:
  - `AWS_SUBNET_ID_US_EAST_1`, `AWS_SECURITY_GROUP_ID_US_EAST_1`, `AWS_AMI_ID_US_EAST_1`
  - Same pattern for other regions (`ap-south-1` -> `AP_SOUTH_1`, etc.)
- Fallback order:
  1. Region-specific env var
  2. Global env var (`AWS_SUBNET_ID`, etc.)
  3. Built-in default AMI map (for `AWS_AMI_ID` only)

### EC2 Logs (Nest Logger)

`AwsProvisionerService` logs:
- Launch request details (region, AMI, webapp/instance IDs)
- Initial EC2 launch state
- Warning if instance does not reach `running`
- Success with `publicIp` and `privateIp`
- Error with stack trace when provisioning fails

## Local Setup Guide

### 1) Prerequisites

- Node.js 20+
- Yarn 1.x (`yarn -v` should show `1.22.x`)
- PostgreSQL (local or Docker)
- Redis (local or Docker)

### 2) Install dependencies

```bash
yarn install
```

### 3) Create environment file

Create `.env` in backend root (`kuberns-backend/.env`).

```env
# App
PORT=3000
NODE_ENV=development

# Postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=kuberns

# Redis
REDIS_URL=
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false

# Security / crypto
# 32-byte key as 64 hex chars
ENCRYPTION_KEY=<64_hex_chars>

# Optional (currently not actively used by endpoints)
JWT_SECRET=change-me
JWT_EXPIRES_IN=86400

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_MOCK_MODE=true

# Global network defaults (used when region-specific vars are absent)
AWS_SUBNET_ID=
AWS_SECURITY_GROUP_ID=
AWS_AMI_ID=

# Optional region-specific overrides (example for us-east-1)
AWS_SUBNET_ID_US_EAST_1=
AWS_SECURITY_GROUP_ID_US_EAST_1=
AWS_AMI_ID_US_EAST_1=
```

Generate `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

### 4) Start dependencies quickly with Docker (optional)

```bash
docker run --name kuberns-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kuberns -p 5432:5432 -d postgres:16

docker run --name kuberns-redis -p 6379:6379 -d redis:7
```

### 5) Run backend

```bash
# watch mode
yarn start:dev
```

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs`

### 6) Verify with curl

Create a webapp:

```bash
curl -X POST http://localhost:3000/webapps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "kuberns-from-frontend",
    "region": "us-east-1",
    "framework": "express",
    "plan": "pro",
    "orgId": "org-1",
    "repoId": "repo-1",
    "branch": "dev",
    "environments": [
      {
        "branch": "dev",
        "assignRandomPort": true,
        "envVariables": [{ "key": "some_key", "value": "secret-value" }],
        "instances": [{}]
      }
    ]
  }'
```

Poll status:

```bash
curl http://localhost:3000/webapps/1/status
```

## Postman Collection

An import-ready Postman collection is included in this repository:

- `postman/kuberns-backend.postman_collection.json`

### Import Steps

1. Open Postman.
2. Click `Import`.
3. Select `postman/kuberns-backend.postman_collection.json`.
4. Run requests from the `Kuberns Backend` collection.

### Included Requests

- `GET {{baseUrl}}/` (Health Check)
- `GET {{baseUrl}}/api/docs` (Swagger UI)
- `POST {{baseUrl}}/webapps` (Create WebApp)
- `GET {{baseUrl}}/webapps` (List WebApps)
- `GET {{baseUrl}}/webapps/{{webappId}}` (Get WebApp by ID)
- `GET {{baseUrl}}/webapps/{{webappId}}/status` (Deployment Status)

### Collection Variables

- `baseUrl` (default: `http://localhost:3000`)
- `webappId` (default: `1`)

`Create WebApp` test script automatically stores the created `id` into `webappId`, so the next detail/status requests use the latest created app.

## Scripts

- `yarn start` - start app
- `yarn start:dev` - start in watch mode
- `yarn start:prod` - run compiled output
- `yarn build` - compile TypeScript
- `yarn lint` - run ESLint
- `yarn test` - run unit tests
- `yarn test:e2e` - run e2e tests

## Important Notes

- `synchronize` is enabled outside production (`NODE_ENV !== production`).
  - Convenient for development.
  - Not recommended for production schema management.
- A dummy user row (`id=1`) is auto-seeded on app bootstrap.
- Current controller uses this dummy user ID instead of auth context.
- Environment variable values are encrypted before DB write; missing `ENCRYPTION_KEY` will break encryption path.
- Queue worker and API run in the same Nest process by default.

## Troubleshooting

- DB connection errors:
  - Check `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`.
- Redis connection errors:
  - If you use Redis auth/managed Redis, set `REDIS_PASSWORD` (and `REDIS_USERNAME` when required).
  - You can also use a single `REDIS_URL` (for example: `redis://username:password@host:6379/0` or `rediss://...`).
  - Check `REDIS_HOST`, `REDIS_PORT` and that Redis is running when not using `REDIS_URL`.
- EC2 provisioning fails in real mode:
  - Ensure `AWS_MOCK_MODE=false`.
  - Verify AWS credentials and IAM permissions.
  - Ensure subnet/security group belong to the selected region.
- `ENCRYPTION_KEY env var is not set`:
  - Add a valid 64-hex-character key in `.env`.

## Suggested Next Improvements

- Add DB migrations (TypeORM migrations) for production safety.
- Replace dummy user wiring with JWT auth + `CurrentUser` decorator.
- Persist EC2 IP/endpoint into `instances` for frontend visibility.
- Add queue retries/backoff and dead-letter handling.

  # AWS EC2 Provisioning only works with us-east-1 region currently
