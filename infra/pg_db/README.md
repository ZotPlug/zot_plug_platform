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
  * start the backend server by following the steps in our [platform dev workflow](https://github.com/kchun510/zot_plug_platform?tab=readme-ov-file#%ef%b8%8fsoftware-development-workflow:~:text=%f0%9f%92%bb%e2%9a%99%ef%b8%8fsoftware%20development%20workflow)


# PostgreSQL Commands
1. Make sure the backend is up.
2. Open a PostgreSQL shell inside the `pg_db` container:
```bash
docker exec -it pg_db psql -U myuser -d mydb
#docker exec -it container_name -U username -d database_name

```

| Command                 | Description                      |
|------------------------|----------------------------------|
| `\dt`                  | List tables                      |
| `\l`                   | List all databases               |
| `\c mydb`              | Connect to a specific database   |
| `\d table_name`        | Show schema for a table          |
| `SELECT * FROM table_name;` | Show contents of a table     |
| `\q`                   | Quit the psql shell              |

