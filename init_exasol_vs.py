import pyexasol

conn = pyexasol.connect(
    dsn='3.214.216.193:8563',
    user='sys',
    password='Iq4LfWTq',
    encryption=True,
    websocket_sslopt={'cert_reqs': 0}
)

def run(label, sql):
    try:
        conn.execute(sql)
        print(f'OK: {label}')
    except Exception as e:
        print(f'ERR: {label}: {str(e)[:200]}')

run('ADAPTER schema', 'CREATE SCHEMA IF NOT EXISTS ADAPTER')

run('MySQL adapter', """CREATE OR REPLACE JAVA ADAPTER SCRIPT ADAPTER.MYSQL_ADAPTER AS
  %scriptclass com.exasol.adapter.RequestDispatcher;
  %jar /buckets/bfsdefault/default/virtual-schema-dist-12.0.0-mysql-5.0.2.jar;
  %jar /buckets/bfsdefault/default/mysql-connector-j-8.3.0.jar;
/""")

run('Snowflake adapter', """CREATE OR REPLACE JAVA ADAPTER SCRIPT ADAPTER.SNOWFLAKE_ADAPTER AS
  %scriptclass com.exasol.adapter.RequestDispatcher;
  %jar /buckets/bfsdefault/default/virtual-schema-dist-12.0.1-snowflake-0.1.4.jar;
  %jar /buckets/bfsdefault/default/snowflake-jdbc-3.13.30.jar;
/""")

run('MySQL connection', """CREATE OR REPLACE CONNECTION AIVEN_MYSQL
  TO 'jdbc:mysql://mysql-41c9e36-yuvarajm3119-46ea.c.aivencloud.com:22592/defaultdb?sslMode=REQUIRED'
  USER 'avnadmin'
  IDENTIFIED BY '***REMOVED***'""")

run('Snowflake connection', """CREATE OR REPLACE CONNECTION SNOWFLAKE_CONN
  TO 'jdbc:snowflake://VSMHCHE-UC35569.snowflakecomputing.com/?db=SNOWFLAKE_SAMPLE_DATA&schema=TPCH_SF1&warehouse=COMPUTE_WH'
  USER 'YUVARAJM'
  IDENTIFIED BY 'ExasolDemo17051984'""")

run('Drop MySQL VS', 'DROP VIRTUAL SCHEMA IF EXISTS NEXUSIQ_VS CASCADE')
run('Create MySQL VS', """CREATE VIRTUAL SCHEMA NEXUSIQ_VS
  USING ADAPTER.MYSQL_ADAPTER
  WITH
    CONNECTION_NAME = 'AIVEN_MYSQL'
    CATALOG_NAME    = 'defaultdb'
    TABLE_FILTER    = 'customers,employees,products,projects,sales_orders,budget_actuals'""")

run('Drop Snowflake VS', 'DROP VIRTUAL SCHEMA IF EXISTS SNOWFLAKE_VS CASCADE')
run('Create Snowflake VS', """CREATE VIRTUAL SCHEMA SNOWFLAKE_VS
  USING ADAPTER.SNOWFLAKE_ADAPTER
  WITH
    CONNECTION_NAME = 'SNOWFLAKE_CONN'
    SCHEMA_NAME     = 'TPCH_SF1'""")

print('\n=== Virtual Tables ===')
rows = conn.execute("SELECT TABLE_SCHEMA, TABLE_NAME FROM SYS.EXA_ALL_VIRTUAL_TABLES ORDER BY TABLE_SCHEMA").fetchall()
for r in rows:
    print(f'  {r[0]}.{r[1]}')

conn.close()
print('\nDone!')
