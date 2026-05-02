import pyexasol
import getpass

exa_pwd  = getpass.getpass("Exasol password (exasol): ")
sf_pwd   = getpass.getpass("Snowflake password: ")
dbc_pat  = getpass.getpass("Databricks PAT token: ")

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
        print(f"   ERROR: {str(e)[:500]}")

run("Create ADAPTER schema", "CREATE SCHEMA IF NOT EXISTS ADAPTER")

# ══════════════════════════════════════════════════════
# 1. SNOWFLAKE VIRTUAL SCHEMA
# ══════════════════════════════════════════════════════
run("Snowflake adapter script",
    """CREATE OR REPLACE JAVA ADAPTER SCRIPT ADAPTER.SNOWFLAKE_ADAPTER AS
  %scriptclass com.exasol.adapter.RequestDispatcher;
  %jar /buckets/bfsdefault/default/virtual-schema-dist-12.0.1-snowflake-0.1.4.jar;
  %jar /buckets/bfsdefault/default/snowflake-jdbc-3.13.30.jar;
/""")

run("Snowflake connection",
    f"""CREATE OR REPLACE CONNECTION SNOWFLAKE_CONN
  TO 'jdbc:snowflake://tcsavgy-vc05902.snowflakecomputing.com/?warehouse=yuvishere_wh&db=yuvishere_db&schema=raw&ssl=on'
  USER 'yuvishere'
  IDENTIFIED BY '{sf_pwd}'""")

run("Drop Snowflake VS", "DROP VIRTUAL SCHEMA IF EXISTS SNOWFLAKE_VS CASCADE")

run("Create Snowflake VS",
    """CREATE VIRTUAL SCHEMA SNOWFLAKE_VS
  USING ADAPTER.SNOWFLAKE_ADAPTER
  WITH
    CONNECTION_NAME = 'SNOWFLAKE_CONN'
    CATALOG_NAME    = 'YUVISHERE_DB'
    SCHEMA_NAME     = 'RAW'""")

# ══════════════════════════════════════════════════════
# 2. DATABRICKS VIRTUAL SCHEMA
# ══════════════════════════════════════════════════════
run("Databricks adapter script",
    """CREATE OR REPLACE LUA ADAPTER SCRIPT ADAPTER.DATABRICKS_ADAPTER AS
    local scriptDir = '/buckets/bfsdefault/default'
    package.path = scriptDir .. '/?.lua;' .. package.path
    local adapter = require('databricks-virtual-schema-dist-1.0.2')
    adapter.adapter()
/""")

run("Databricks connection",
    f"""CREATE OR REPLACE CONNECTION DATABRICKS_CONN
  TO 'jdbc:databricks://dbc-69ced1cd-bfc0.cloud.databricks.com:443/default;transportMode=http;ssl=1;httpPath=/sql/1.0/warehouses/4f33f1e8a5203c7d;AuthMech=3;UID=token;PWD={dbc_pat}'
  USER 'token'
  IDENTIFIED BY '{dbc_pat}'""")

run("Drop Databricks VS", "DROP VIRTUAL SCHEMA IF EXISTS DATABRICKS_VS CASCADE")

run("Create Databricks VS",
    """CREATE VIRTUAL SCHEMA DATABRICKS_VS
  USING ADAPTER.DATABRICKS_ADAPTER
  WITH
    CONNECTION_NAME = 'DATABRICKS_CONN'
    CATALOG_NAME    = 'samples'
    SCHEMA_NAME     = 'nyctaxi'""")

# ══════════════════════════════════════════════════════
# VERIFY
# ══════════════════════════════════════════════════════
print("\n\n=== VIRTUAL SCHEMAS ===")
try:
    result = conn.execute("SELECT SCHEMA_NAME, ADAPTER_SCRIPT_NAME FROM EXA_ALL_VIRTUAL_SCHEMAS ORDER BY SCHEMA_NAME")
    for r in result.fetchall():
        print(f"  {r[0]} → {r[1]}")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n=== TABLES ===")
for vs in ["SNOWFLAKE_VS", "DATABRICKS_VS"]:
    try:
        result = conn.execute(f"SELECT TABLE_NAME FROM SYS.EXA_ALL_VIRTUAL_TABLES WHERE TABLE_SCHEMA = '{vs}' ORDER BY TABLE_NAME")
        rows = result.fetchall()
        print(f"\n  {vs}: {len(rows)} tables")
        for r in rows:
            print(f"    - {r[0]}")
    except Exception as e:
        print(f"  {vs} ERROR: {str(e)[:200]}")

conn.close()
print("\n✅ Done!")