import winston from 'winston';
import { ecsFormat } from '@elastic/ecs-winston-format';
import { env } from '$env/dynamic/private';

const isProduction = env.NODE_ENV === 'production';

// Custom format for console output (keeping the existing format for development)
const consoleFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.colorize(),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		let log = `${timestamp} [${level}]: ${message}`;
		if (Object.keys(meta).length > 0) {
			log += ` ${JSON.stringify(meta)}`;
		}
		return log;
	})
);

// Create the main logger with ECS format. In production, we log ECS to stdout.
const logger = winston.createLogger({
	level: isProduction ? 'info' : 'debug',
	format: ecsFormat({
		// Enable error conversion to ECS error fields
		convertErr: true,
		// Enable HTTP request/response conversion to ECS fields
		convertReqRes: true,
		// Enable APM integration if available
		apmIntegration: true,
		// Service information
		serviceName: 'amazon-review-automation',
		serviceVersion: env.npm_package_version || '0.0.1',
		serviceEnvironment: env.NODE_ENV || 'development',
		serviceNodeName: env.HOSTNAME || 'localhost',
		// Event dataset for correlation in Kibana
		eventDataset: 'amazon-review-automation'
	}),
	transports: [
		// Console transport - always enabled
		// In dev: pretty printed format
		// In prod (serverless): ECS JSON format for cloud logging
		new winston.transports.Console({
			level: isProduction ? 'info' : 'debug',
			...(isProduction ? {} : { format: consoleFormat })
		}),
		// File transport - only in development (single file)
		// Disabled in production for serverless compatibility
		...(isProduction
			? []
			: [
					new winston.transports.File({
						filename: 'storage/logs/combined.log',
						level: 'debug',
						format: winston.format.combine(winston.format.timestamp(), winston.format.json())
					})
				])
	],
	// Handle uncaught exceptions and rejections to console as well
	exceptionHandlers: [
		new winston.transports.Console({ ...(isProduction ? {} : { format: consoleFormat }) })
	],
	rejectionHandlers: [
		new winston.transports.Console({ ...(isProduction ? {} : { format: consoleFormat }) })
	]
});

// Export the logger directly for direct usage
export { logger };

export default logger;
