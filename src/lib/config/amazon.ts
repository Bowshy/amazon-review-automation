import { env } from '$env/dynamic/private';

export interface AmazonConfig {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	marketplaceId: string;
}

export function getAmazonConfig(): AmazonConfig {
	return {
		clientId: env.AMAZON_CLIENT_ID || '',
		clientSecret: env.AMAZON_CLIENT_SECRET || '',
		refreshToken: env.AMAZON_REFRESH_TOKEN || '',
		marketplaceId: env.AMAZON_MARKETPLACE_ID || ''
	};
}

export function validateAmazonConfig(config: AmazonConfig): boolean {
	return !!(config.clientId && config.clientSecret && config.refreshToken && config.marketplaceId);
}
