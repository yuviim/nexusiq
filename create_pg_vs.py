import pyexasol
import getpass

exa_pwd = getpass.getpass("Exasol password (exasol): ")
pg_pwd  = getpass.getpass("Aiven PostgreSQL password: ")

PG_HOST = input("Aiven PostgreSQL host: ").strip()
PG_PORT = input("Aiven PostgreSQL port: ").strip()

conn = pyexasol.connect(
    dsn="18.232.62.176:8563",
    user="sys",
    password=exa_pwd,
    encryption=True,
    websocket_sslopt={"cert_reqs": 0}
)
print("Connected to Exasol ✅")

def run(label, sql):
    print(f"\n-> {label}...")
    try:
        conn.execute(sql)
        print("   Done ✅")
    except Exception as e:
        print(f"   ERROR: {str(e)[:300]}")

run("PostgreSQL adapter script",
    """CREATE OR REPLACE JAVA ADAPTER SCRIPT ADAPTER.POSTGRESQL_ADAPTER AS
  %scriptclass com.exasol.adapter.RequestDispatcher;
  %jar /buckets/bfsdefault/default/virtual-schema-dist-13.0.0-postgresql-3.1.1.jar;
  %jar /buckets/bfsdefault/default/postgresql-jdbc.jar;
/""")

run("PostgreSQL connection",
    f"""CREATE OR REPLACE CONNECTION AIVEN_PG
  TO 'jdbc:postgresql://{PG_HOST}:{PG_PORT}/defaultdb?sslmode=require'
  USER 'avnadmin'
  IDENTIFIED BY '{pg_pwd}'""")

run("Drop PostgreSQL VS", "DROP VIRTUAL SCHEMA IF EXISTS POSTGRES_VS CASCADE")

run("Create PostgreSQL VS",
    """CREATE VIRTUAL SCHEMA POSTGRES_VS
  USING ADAPTER.POSTGRESQL_ADAPTER
  WITH
    CONNECTION_NAME = 'AIVEN_PG'
    SCHEMA_NAME     = 'public'""")

print("\n=== ALL VIRTUAL SCHEMAS ===")
result = conn.execute("SELECT SCHEMA_NAME FROM EXA_ALL_VIRTUAL_SCHEMAS ORDER BY SCHEMA_NAME")
for r in result.fetchall():
    print(f"  {r[0]}")

print("\n=== POSTGRES VS TABLES ===")
try:
    result = conn.execute("SELECT TABLE_NAME FROM SYS.EXA_ALL_VIRTUAL_TABLES WHERE TABLE_SCHEMA = 'POSTGRES_VS' ORDER BY TABLE_NAME")
    rows = result.fetchall()
    print(f"  {len(rows)} tables")
    for r in rows:
        print(f"    - {r[0]}")
except Exception as e:
    print(f"  ERROR: {str(e)[:200]}")

conn.close()
print("\n✅ Done!")