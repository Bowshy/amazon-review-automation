import { config } from 'dotenv';

// Load environment variables
config();

const DB_HOST = process.env.DB_HOST || '';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_USERNAME = process.env.DB_USERNAME || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || '';

export function getDatabaseUrl(): string {
	// Check if we're using Supabase (indicated by supabase.co in host)
	const isSupabase = DB_HOST.includes('supabase.co');

	if (isSupabase) {
		// Supabase connection with PgBouncer compatibility
		return `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&pgbouncer=true&connection_limit=30&pool_timeout=20&statement_timeout=30000&idle_in_transaction_session_timeout=30000&application_name=amazon-review-automation`;
	} else {
		// Standard PostgreSQL connection
		return `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&connection_limit=30&pool_timeout=20&statement_timeout=30000&idle_in_transaction_session_timeout=30000&application_name=amazon-review-automation`;
	}
}

export function getDirectDatabaseUrl(): string {
	// Direct connection for migrations (bypasses connection pooling)
	const isSupabase = DB_HOST.includes('supabase.co');

	if (isSupabase) {
		// For Supabase, use the direct database connection (not the pooler)
		// Replace pooler URL with direct database URL
		const directHost = DB_HOST.replace('.pooler.supabase.com', '.supabase.co').replace(
			'aws-0-',
			'db.'
		);
		return `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${directHost}:5432/${DB_NAME}?schema=public&connection_limit=1&pool_timeout=20&statement_timeout=30000&application_name=amazon-review-automation-migrations`;
	} else {
		// For non-Supabase, use the same connection but with different limits
		return `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&connection_limit=1&pool_timeout=20&statement_timeout=30000&application_name=amazon-review-automation-migrations`;
	}
}

// Export the DATABASE_URL for Drizzle
export const DATABASE_URL = getDatabaseUrl();

// Export the DIRECT_URL for Drizzle migrations
export const DIRECT_URL = getDirectDatabaseUrl();
