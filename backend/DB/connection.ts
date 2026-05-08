import mongoose from 'mongoose';
import { env } from '../config/env';
import { DB_RETRY } from '../config/constants';
import { logger } from '../utils/logger';

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const connectWithRetry = async (attempt = 1): Promise<void> => {
    try {
        await mongoose.connect(env.MONGO_URI);
        logger.info({ attempt }, 'Connected to MongoDB');
    } catch (error) {
        logger.error({ err: error, attempt }, 'MongoDB connection failed');

        if (attempt >= DB_RETRY.MAX_ATTEMPTS) {
            logger.fatal(
                { attempt, max: DB_RETRY.MAX_ATTEMPTS },
                'Exceeded MongoDB connection retries — giving up'
            );
            throw error;
        }

        const delay = Math.min(
            DB_RETRY.INITIAL_DELAY_MS * 2 ** (attempt - 1),
            DB_RETRY.MAX_DELAY_MS
        );
        logger.warn({ attempt, delayMs: delay }, 'Retrying MongoDB connection');
        await sleep(delay);
        return connectWithRetry(attempt + 1);
    }
};

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — driver will attempt to reconnect');
});

mongoose.connection.on('error', (err: Error) => {
    logger.error({ err }, 'MongoDB connection error');
});

const connectDB = (): Promise<void> => connectWithRetry();

export default connectDB;
