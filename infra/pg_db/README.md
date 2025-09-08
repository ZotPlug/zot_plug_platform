# PostgreSQL Setup (Docker)
1. Start PostgreSQL with Docker
  * start the backend server by following the steps in our [platform dev workflow](https://github.com/kchun510/zot_plug_platform?tab=readme-ov-file#%ef%b8%8fsoftware-development-workflow:~:text=%f0%9f%92%bb%e2%9a%99%ef%b8%8fsoftware%20development%20workflow)


# PostgreSQL Commands
1. Make sure the backend is up.
2. Open a PostgreSQL shell inside the `pg_db` container:
```bash
docker exec -it pg_db_dev psql -U myuser -d mydb
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

# PostgreSQL DB ER Diagram
<img width="1003" height="1239" alt="image" src="https://github.com/user-attachments/assets/40d37530-2d89-4afb-91e3-de9fd085493e" />
