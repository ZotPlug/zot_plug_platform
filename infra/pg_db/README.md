# PostgreSQL Setup (Docker + .env)

1. Create a .env File

At the following path in your project:

zot_plug_platform\infra\pg_db\

Create a file named .env and add the following content:
PG_HOST=postgres
PG_PORT=5432
PG_USER=myuser
PG_PASSWORD=mypassword
PG_DATABASE=mydb


2. Start PostgreSQL with Docker
