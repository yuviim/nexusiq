#!/bin/bash
source ~/Desktop/nexusiq/.env

ACR_PASSWORD=$(az acr credential show --name nexusiqacryuvi --query passwords[0].value -o tsv)

az containerapp create \
  --name nexusiq-api \
  --resource-group nexusiq-rg \
  --environment nexusiq-env \
  --image nexusiqacryuvi.azurecr.io/nexusiq-backend:latest \
  --registry-server nexusiqacryuvi.azurecr.io \
  --registry-username nexusiqacryuvi \
  --registry-password $ACR_PASSWORD \
  --target-port 8000 \
  --ingress external \
  --env-vars \
    "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
    "AZURE_TENANT_ID=$AZURE_TENANT_ID" \
    "AZURE_CLIENT_ID=$AZURE_CLIENT_ID" \
    "AZURE_CLIENT_SECRET=$AZURE_CLIENT_SECRET" \
    "SHAREPOINT_SITE_IDS=$SHAREPOINT_SITE_IDS" \
    "DB_DSN=snowflake://yuvishere:Pulsar%4017051984@tcsavgy-vc05902/yuvishere_db/raw?warehouse=yuvishere_wh" \
    "CHROMA_HOST=nexusiq-chromadb.internal.icymoss-0880742e.eastus2.azurecontainerapps.io" \
    "CHROMA_PORT=443" \
    "SQL_MCP_HOST=nexusiq-sql-mcp.internal.icymoss-0880742e.eastus2.azurecontainerapps.io" \
    "SQL_MCP_PORT=443" \
    "SQL_MCP_TRANSPORT=sse" \
    "SHAREPOINT_MCP_HOST=nexusiq-sp-mcp.internal.icymoss-0880742e.eastus2.azurecontainerapps.io" \
    "SHAREPOINT_MCP_PORT=443" \
    "SHAREPOINT_MCP_TRANSPORT=sse" \
    "DB_MAX_ROWS=500" \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi

API_URL=$(az containerapp show \
  --name nexusiq-api \
  --resource-group nexusiq-rg \
  --query properties.configuration.ingress.fqdn -o tsv)

echo ""
echo "=========================================="
echo "API live at: https://$API_URL"
echo "Test: curl https://$API_URL/api/health"
echo "=========================================="
