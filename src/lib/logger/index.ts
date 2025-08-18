import winston from 'winston';
import { ecsFormat } from '@elastic/ecs-winston-format';

const isProduction = process.env.NODE_ENV === 'production';

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
    serviceVersion: process.env.npm_package_version || '0.0.1',
    serviceEnvironment: process.env.NODE_ENV || 'development',
    serviceNodeName: process.env.HOSTNAME || 'localhost',
    // Event dataset for correlation in Kibana
    eventDataset: 'amazon-review-automation'
  }),
  transports: [
    // Console transport only. In dev, pretty print; in prod, inherit ECS JSON from logger.format
    new winston.transports.Console({
      level: isProduction ? 'info' : 'debug',
      ...(isProduction ? {} : { format: consoleFormat })
    })
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
