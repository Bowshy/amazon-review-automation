import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file (same approach as database config)
dotenvConfig();

export interface AmazonConfig {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	marketplaceId: string;
}

export function getAmazonConfig(): AmazonConfig {
	return {
		clientId: process.env.AMAZON_CLIENT_ID || '',
		clientSecret: process.env.AMAZON_CLIENT_SECRET || '',
		refreshToken: process.env.AMAZON_REFRESH_TOKEN || '',
		marketplaceId: process.env.AMAZON_MARKETPLACE_ID || ''
	};
}

export function validateAmazonConfig(config: AmazonConfig): boolean {
	return !!(config.clientId && config.clientSecret && config.refreshToken && config.marketplaceId);
}
