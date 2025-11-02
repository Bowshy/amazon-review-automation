# Database Best Practices Implementation

## Prepared Statement Error Resolution

### Problem Description

The application was experiencing PostgreSQL prepared statement errors:

```
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "26000", message: "prepared statement \"s21\" does not exist", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })
```

This error typically occurs when:

1. Connection pooling issues cause prepared statements to become stale
2. Database connections are dropped or reset unexpectedly
3. ORM's internal statement caching conflicts with PostgreSQL's prepared statement management
4. High concurrency causes connection exhaustion

### Solution Implementation

#### 1. Enhanced Database Configuration (`src/lib/db/config/database-url.ts`)

**Key Changes:**

- Reduced connection pool size from 10 to 5 to prevent connection exhaustion
- Configured connection timeouts for better stability
- Added comprehensive error handling and connection reset functionality
- Optimized connection parameters for Drizzle ORM

```typescript
export function getDatabaseUrl(): string {
	return `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&connection_limit=5&pool_timeout=60&statement_timeout=30000&idle_in_transaction_session_timeout=30000&application_name=amazon-review-automation`;
}
```

#### 2. Robust Error Handling in Database Service (`src/lib/db/services/database.ts`)

**Key Changes:**

- Implemented `executeWithRetry` utility method for consistent error handling
- Separated complex queries to avoid prepared statement issues
- Added connection reset functionality for prepared statement errors
- Improved activity logs query to fetch related data separately

```typescript
private async executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = 'database operation'
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (handlePreparedStatementError(error)) {
        if (attempt < maxRetries) {
          await resetConnection();
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error(`Failed to execute ${operationName} after all retries`);
}
```

#### 4. Activity Logs Query Optimization

**Problem:** The original query used `include` which can cause prepared statement issues with complex relations.

**Solution:** Split the query into two parts:

1. Fetch activity logs without includes
2. Fetch related order data separately and merge

```typescript
async getActivityLogs(limit: number = 50, orderId?: string, action?: string): Promise<any[]> {
  return await this.executeWithRetry(async () => {
    // First fetch logs without relations
    const logs = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        details: activityLogs.details,
        orderId: activityLogs.orderId,
        createdAt: activityLogs.createdAt
      })
      .from(activityLogs)
      .where(whereConditions)
      .orderBy(desc(activityLogs.createdAt))
      .limit(Math.min(limit, 1000));

    // Then fetch order details separately if needed
    if (logs.length > 0 && logs.some(log => log.orderId)) {
      const orderIds = [...new Set(logs.filter(log => log.orderId).map(log => log.orderId))];
      const orders = await db
        .select({ id: amazonOrders.id, amazonOrderId: amazonOrders.amazonOrderId })
        .from(amazonOrders)
        .where(inArray(amazonOrders.id, orderIds));

      const orderMap = new Map(orders.map(order => [order.id, order]));
      return logs.map(log => ({
        ...log,
        order: log.orderId ? orderMap.get(log.orderId) || null : null
      }));
    }

    return logs;
  }, 3, 'get activity logs');
}
```

### Testing and Validation

#### Test Script (`scripts/test-database-connection.js`)

Created a comprehensive test script to validate the fixes:

```bash
node scripts/test-database-connection.js
```

The script tests:

1. Database health check
2. Connection pool information
3. Activity logs functionality
4. Dashboard stats retrieval

### Best Practices for Prevention

#### 1. Connection Pool Management

- Keep connection pool size reasonable (5-10 connections)
- Monitor connection usage with `getConnectionInfo()`
- Implement proper connection cleanup on application shutdown

#### 2. Query Optimization

- Avoid complex joins with relations in high-frequency queries
- Use `select` to fetch only needed columns
- Split complex queries into simpler, separate queries
- Implement proper pagination to limit result sets

#### 3. Error Handling

- Always implement retry logic for database operations
- Handle prepared statement errors specifically
- Log errors with sufficient context for debugging
- Implement circuit breaker pattern for critical operations

#### 4. Monitoring and Alerting

- Monitor database connection health regularly
- Set up alerts for connection pool exhaustion
- Track query performance and prepared statement usage
- Monitor application logs for database-related errors

#### 5. Database Configuration

- Set appropriate PostgreSQL timeouts
- Configure connection limits properly
- Use connection pooling at the database level if needed
- Monitor and tune PostgreSQL settings for your workload

### Performance Considerations

#### Connection Pool Sizing

- **Too small:** Can cause connection waiting and timeouts
- **Too large:** Can exhaust database resources
- **Optimal:** 5-10 connections for most web applications

#### Query Optimization

- Use database indexes effectively
- Implement query result caching where appropriate
- Monitor slow queries and optimize them
- Use database connection pooling at the application level

#### Prepared Statement Management

- Disable statement caching if experiencing conflicts
- Monitor prepared statement usage
- Implement proper cleanup procedures
- Use connection reset when needed

### Troubleshooting Guide

#### Common Issues and Solutions

1. **"prepared statement does not exist"**
   - Solution: Implement connection reset and retry logic
   - Prevention: Disable statement caching, monitor connection health

2. **Connection pool exhaustion**
   - Solution: Reduce pool size, implement connection timeouts
   - Prevention: Monitor connection usage, implement proper cleanup

3. **Query timeouts**
   - Solution: Increase timeout values, optimize queries
   - Prevention: Use proper indexing, implement query optimization

4. **High memory usage**
   - Solution: Implement result set limiting, use pagination
   - Prevention: Monitor query performance, optimize data fetching

### Monitoring and Maintenance

#### Regular Tasks

1. Monitor database connection health
2. Check query performance metrics
3. Review error logs for database issues
4. Update database configuration as needed
5. Test connection resilience regularly

#### Alerting Setup

- Database connection failures
- High connection pool usage
- Query timeout occurrences
- Prepared statement errors
- Database performance degradation

This implementation provides a robust, production-ready solution for handling database connection issues and prepared statement errors while maintaining good performance and reliability.
