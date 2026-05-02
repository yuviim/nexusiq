import random
from datetime import datetime, timedelta
from faker import Faker
import pandas as pd

fake = Faker()
random.seed(42)
Faker.seed(42)

# ── Customers ─────────────────────────────────────────────────────────────────

segments   = ["Enterprise", "Mid-Market", "SMB", "Startup"]
countries  = ["USA", "UK", "Germany", "France", "India", "Australia", "Canada", "Singapore"]
rev_tiers  = ["Platinum", "Gold", "Silver", "Bronze"]

customers = []
for i in range(1, 201):
    customers.append({
        "customer_id":   i,
        "company_name":  fake.company(),
        "contact_name":  fake.name(),
        "email":         fake.company_email(),
        "country":       random.choice(countries),
        "segment":       random.choice(segments),
        "revenue_tier":  random.choice(rev_tiers),
        "since_date":    fake.date_between(start_date="-5y", end_date="-6m"),
        "is_active":     random.choice([1, 1, 1, 0]),
    })

df_customers = pd.DataFrame(customers)

# ── Products ──────────────────────────────────────────────────────────────────

categories = ["Software", "Hardware", "Services", "Support", "Training"]
products = []
product_names = [
    "NexusIQ Pro", "DataVault Enterprise", "CloudSync Basic", "Analytics Suite",
    "SecureGateway", "API Manager", "DevOps Toolkit", "ML Platform",
    "Data Warehouse", "Integration Hub", "Reporting Engine", "Identity Manager",
    "Backup Solution", "Monitoring Agent", "Compliance Scanner", "ETL Pipeline",
    "Query Optimizer", "Cache Manager", "Load Balancer", "Event Streaming",
]

for i, name in enumerate(product_names, 1):
    unit_price = round(random.uniform(500, 50000), 2)
    products.append({
        "product_id":   i,
        "product_name": name,
        "category":     random.choice(categories),
        "unit_price":   unit_price,
        "stock_qty":    random.randint(0, 500),
        "reorder_level": random.randint(10, 50),
        "is_active":    random.choice([1, 1, 1, 0]),
    })

df_products = pd.DataFrame(products)

# ── Employees ─────────────────────────────────────────────────────────────────

departments = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations", "Product"]
roles = {
    "Engineering": ["Senior Engineer", "Staff Engineer", "Engineering Manager", "VP Engineering", "Junior Engineer"],
    "Sales":       ["Account Executive", "Sales Manager", "VP Sales", "SDR", "Sales Director"],
    "Marketing":   ["Marketing Manager", "Content Lead", "CMO", "Growth Manager", "Brand Designer"],
    "HR":          ["HR Manager", "Recruiter", "CHRO", "HR Business Partner", "L&D Specialist"],
    "Finance":     ["Financial Analyst", "CFO", "Controller", "FP&A Manager", "Accountant"],
    "Operations":  ["Operations Manager", "COO", "Process Analyst", "Ops Specialist", "IT Manager"],
    "Product":     ["Product Manager", "CPO", "Product Analyst", "UX Designer", "Product Director"],
}
salary_range = {
    "Engineering": (80000, 180000),
    "Sales":       (60000, 150000),
    "Marketing":   (65000, 130000),
    "HR":          (55000, 110000),
    "Finance":     (70000, 140000),
    "Operations":  (60000, 120000),
    "Product":     (90000, 160000),
}

employees = []
for i in range(1, 151):
    dept = random.choice(departments)
    lo, hi = salary_range[dept]
    employees.append({
        "employee_id":  i,
        "full_name":    fake.name(),
        "email":        fake.company_email(),
        "department":   dept,
        "role":         random.choice(roles[dept]),
        "salary":       round(random.uniform(lo, hi), 2),
        "hire_date":    fake.date_between(start_date="-8y", end_date="-1m"),
        "manager_id":   random.randint(1, 20) if i > 20 else None,
        "is_active":    random.choice([1, 1, 1, 1, 0]),
    })

df_employees = pd.DataFrame(employees)

# ── Projects ──────────────────────────────────────────────────────────────────

statuses = ["active", "completed", "on_hold", "cancelled"]
project_names = [
    "NexusIQ v2 Launch", "Data Migration 2025", "Cloud Infrastructure Upgrade",
    "CRM Integration", "Security Audit", "Mobile App Redesign", "API Gateway",
    "ML Pipeline Build", "Customer Portal", "ERP Implementation", "BI Dashboard",
    "DevOps Automation", "Compliance Framework", "Data Warehouse Migration",
    "Partner Integration", "Employee Self-Service", "Real-time Analytics",
    "Disaster Recovery", "Identity Platform", "Cost Optimisation",
]

projects = []
for i, name in enumerate(project_names, 1):
    budget = round(random.uniform(50000, 800000), 2)
    status = random.choice(statuses)
    spent  = round(budget * random.uniform(0.3, 1.2), 2) if status != "cancelled" else 0
    projects.append({
        "project_id":   i,
        "project_name": name,
        "department":   random.choice(departments),
        "budget":       budget,
        "spent":        spent,
        "status":       status,
        "start_date":   fake.date_between(start_date="-2y", end_date="-3m"),
        "end_date":     fake.date_between(start_date="-2m", end_date="+6m"),
        "owner_id":     random.randint(1, 150),
    })

df_projects = pd.DataFrame(projects)

# ── Sales Orders ──────────────────────────────────────────────────────────────

sales_reps = [e["full_name"] for e in employees if e["department"] == "Sales"][:10]

sales_orders = []
for i in range(1, 501):
    product   = random.choice(products)
    quantity  = random.randint(1, 20)
    unit_price = product["unit_price"]
    discount  = round(random.uniform(0, 0.25), 2)
    amount    = round(unit_price * quantity * (1 - discount), 2)
    order_date = fake.date_between(start_date="-2y", end_date="today")
    sales_orders.append({
        "order_id":    i,
        "customer_id": random.randint(1, 200),
        "product_id":  product["product_id"],
        "sales_rep":   random.choice(sales_reps) if sales_reps else "Unknown",
        "quantity":    quantity,
        "unit_price":  unit_price,
        "discount":    discount,
        "amount":      amount,
        "order_date":  order_date,
        "quarter":     f"Q{(order_date.month - 1) // 3 + 1}",
        "year":        order_date.year,
        "status":      random.choice(["completed", "completed", "completed", "pending", "cancelled"]),
    })

df_sales = pd.DataFrame(sales_orders)

# ── Budget vs Actuals ─────────────────────────────────────────────────────────

expense_categories = ["Salaries", "Software", "Hardware", "Marketing", "Travel", "Training", "Contractors"]
quarters = ["Q1", "Q2", "Q3", "Q4"]
years    = [2024, 2025]

budget_actuals = []
row_id = 1
for year in years:
    for quarter in quarters:
        for dept in departments:
            for category in expense_categories:
                budget = round(random.uniform(10000, 500000), 2)
                actual = round(budget * random.uniform(0.7, 1.3), 2)
                budget_actuals.append({
                    "id":        row_id,
                    "year":      year,
                    "quarter":   quarter,
                    "department": dept,
                    "category":  category,
                    "budget":    budget,
                    "actual":    actual,
                    "variance":  round(actual - budget, 2),
                })
                row_id += 1

df_budget = pd.DataFrame(budget_actuals)

# ── Save to Excel ─────────────────────────────────────────────────────────────

output_path = "/tmp/nexusiq_enterprise_data.xlsx"
with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
    df_customers.to_excel(writer, sheet_name="customers",      index=False)
    df_products.to_excel(writer,  sheet_name="products",       index=False)
    df_employees.to_excel(writer, sheet_name="employees",      index=False)
    df_projects.to_excel(writer,  sheet_name="projects",       index=False)
    df_sales.to_excel(writer,     sheet_name="sales_orders",   index=False)
    df_budget.to_excel(writer,    sheet_name="budget_actuals", index=False)

print(f"Excel file created: {output_path}")
print(f"  customers:      {len(df_customers)} rows")
print(f"  products:       {len(df_products)} rows")
print(f"  employees:      {len(df_employees)} rows")
print(f"  projects:       {len(df_projects)} rows")
print(f"  sales_orders:   {len(df_sales)} rows")
print(f"  budget_actuals: {len(df_budget)} rows")