# SmartCDN Analytics & Usage Monitoring

This guide explains how to view and monitor SmartCDN usage statistics in multiple ways.

## 📊 Viewing Usage Statistics

### 1. Built-in Analytics API Endpoints

SmartCDN provides analytics endpoints that return real-time statistics:

#### Summary Analytics
```bash
curl https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/__analytics
```

Returns:
- Cache hit/miss/bypass summary
- Hit rates (percentages)
- Recent request count
- Log buffer statistics

#### Detailed Analytics
```bash
curl https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/__analytics/detailed
```

Returns:
- Complete analytics data structure
- Breakdown by path, status code, and HTTP method
- Recent request details
- Time range metadata

#### Cache Analytics
```bash
curl https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/__analytics/cache
```

Returns:
- Detailed cache statistics
- Breakdown by path patterns
- Breakdown by HTTP status codes
- Breakdown by HTTP methods
- Recent request history

#### Log Statistics
```bash
curl https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/__analytics/logs
```

Returns:
- Log buffer usage
- Buffer size and capacity

### 2. Cloudflare Dashboard Analytics

Cloudflare provides built-in analytics for all Workers in the dashboard:

#### Accessing Dashboard Analytics

1. **Log in to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com
   - Select your account

2. **Navigate to Workers & Pages**
   - Click "Workers & Pages" in the sidebar
   - Select your SmartCDN worker (e.g., `smartcdn-staging`)

3. **View Analytics**
   - The overview shows:
     - **Requests**: Total number of requests
     - **Errors**: Error rate and count
     - **Duration**: Average response time (p50, p99)
     - **CPU Time**: CPU execution time
     - **Subrequests**: Number of subrequests made

4. **View Metrics**
   - Click on "Metrics" tab to see:
     - Request volume over time
     - Error rates
     - Response time percentiles
     - CPU time usage
     - Bandwidth usage

5. **View Logs**
   - Click on "Logs" tab for real-time logs
   - Filter by status code, error type, etc.
   - Search logs by keyword

#### Dashboard Metrics Available

- **Requests**: Total requests served
- **Success Rate**: Percentage of successful requests
- **Error Rate**: Percentage of failed requests
- **Duration**: Response time (p50, p75, p99)
- **CPU Time**: CPU execution time per request
- **Subrequests**: Number of fetch/subrequests
- **Bandwidth**: Data transferred

### 3. Real-Time Logs with Wrangler

View real-time logs directly from your terminal:

```bash
# Tail logs from staging environment
wrangler tail your-worker-name

# Tail logs from production
wrangler tail smartcdn

# Filter logs by status code
wrangler tail your-worker-name --status error

# Filter logs by method
wrangler tail your-worker-name --method GET

# Format logs as JSON
wrangler tail your-worker-name --format json

# Show only errors
wrangler tail your-worker-name --format=pretty | grep -i error
```

### 4. Cloudflare Workers Analytics Engine (WAE)

For more advanced analytics and historical data, you can integrate with Workers Analytics Engine.

#### Setup Workers Analytics Engine

1. **Create Analytics Engine Dataset** (in wrangler.toml):

```toml
[env.staging]
name = "your-worker-name"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
```

2. **Update wrangler.toml** to add the binding:

```toml
[env.staging.vars]
ENVIRONMENT = "staging"

[env.staging.analytics_engine_datasets]
binding = "ANALYTICS"
```

3. **Send events to Analytics Engine** (add to logging.js):

```javascript
export async function sendToAnalyticsEngine(analytics, event) {
  await analytics.writeDataPoint({
    indexes: [event.path || 'unknown'],
    blobs: [
      event.status || 'unknown',
      event.country || 'unknown',
      event.deviceType || 'unknown',
    ],
    doubles: [
      event.responseTime || 0,
      event.cacheLookupTime || 0,
      event.originFetchTime || 0,
    ],
    ts: Date.now(),
  });
}
```

4. **Query Analytics Engine**:

Use Cloudflare GraphQL API or Workers Analytics Engine dashboard to query data.

### 5. Programmatic Access via Workers Metrics API

Query metrics programmatically using Cloudflare API:

```bash
# Get account ID and API token from Cloudflare dashboard
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"

# Get worker metrics
curl -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/your-worker-name/metrics" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
```

## 📈 Key Metrics to Monitor

### Performance Metrics
- **Cache Hit Rate**: Should be >80% for optimal performance
- **Response Time**: P50 <100ms, P99 <500ms
- **Origin Fetch Time**: Average time to fetch from origin
- **Cache Lookup Time**: Time to check cache

### Usage Metrics
- **Total Requests**: Volume of traffic
- **Requests per Path**: Most popular paths
- **Geographic Distribution**: Requests by country/region
- **Device Type Distribution**: Mobile vs Desktop vs Tablet

### Error Metrics
- **Error Rate**: Should be <1%
- **4xx Errors**: Client errors
- **5xx Errors**: Server errors
- **Rate Limit Hits**: 429 responses

### A/B Testing Metrics
- **Variant Distribution**: Traffic split between variants
- **Variant Performance**: Response times per variant
- **Test Participation**: Percentage of users in tests

## 🔍 Example Analytics Queries

### View Cache Performance
```bash
curl https://your-worker-name.YOUR_SUBDOMAIN.workers.dev/__analytics/cache | jq '.summary'
```

### Check Hit Rate
```bash
curl -s https://smartcdn-staging.YOUR_SUBDOMAIN.workers.dev/__analytics | jq '.cache.hitRate'
```

### View Top Paths
```bash
curl -s https://smartcdn-staging.YOUR_SUBDOMAIN.workers.dev/__analytics/cache | jq '.byPath | to_entries | sort_by(.value.total) | reverse | .[0:10]'
```

### Monitor Real-Time Errors
```bash
wrangler tail your-worker-name --status error
```

## 📊 Creating Custom Dashboards

### Using Cloudflare Dashboard
- Customize views in the dashboard
- Set up alerts for key metrics
- Export metrics data for analysis

### Using External Tools
1. **Grafana**: Query Cloudflare API and create dashboards
2. **Datadog**: Integrate with Cloudflare Workers
3. **Custom Dashboard**: Use the analytics API endpoints to build your own

## 🚨 Setting Up Alerts

### Cloudflare Dashboard Alerts
1. Go to Workers & Pages → Your Worker
2. Click "Manage" → "Settings"
3. Set up alerts for:
   - Error rate threshold
   - CPU time threshold
   - Request volume anomalies

### Custom Alerting
Use the analytics API endpoints in a cron job or monitoring service:

```bash
#!/bin/bash
# check-health.sh
HIT_RATE=$(curl -s https://smartcdn-staging.YOUR_SUBDOMAIN.workers.dev/__analytics | jq -r '.cache.hitRate' | sed 's/%//')
if (( $(echo "$HIT_RATE < 70" | bc -l) )); then
  echo "ALERT: Cache hit rate is below 70%: ${HIT_RATE}%"
  # Send alert via email, Slack, etc.
fi
```

## 📝 Notes

- **In-Memory Stats**: The built-in analytics endpoints use in-memory statistics that reset when the worker restarts. For persistent analytics, use Workers Analytics Engine or external services.
- **Rate Limiting**: Consider rate limiting analytics endpoints if they contain sensitive information.
- **Authentication**: Add authentication to analytics endpoints in production (currently they're open).

## 🔒 Securing Analytics Endpoints

To secure analytics endpoints, add authentication:

```javascript
// In analytics.js
function checkAuth(request) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = env.ANALYTICS_TOKEN;
  
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return false;
  }
  
  return true;
}
```

Then protect endpoints:
```javascript
if (!checkAuth(request)) {
  return new Response('Unauthorized', { status: 401 });
}
```

Set the token in `wrangler.toml`:
```toml
[env.staging.vars]
ANALYTICS_TOKEN = "your-secret-token"
```

