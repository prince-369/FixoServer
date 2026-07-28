import mongoose from 'mongoose';
import env from './env';
import logger from '../utils/logger';
import Worker from '../models/Worker';
import Booking from '../models/Booking';

const ensureOperationalIndexes = async (): Promise<void> => {
  try {
    await Worker.collection.createIndex(
      { location: '2dsphere' },
      { name: 'location_2dsphere' }
    );
  } catch (error) {
    logger.error('Failed to ensure worker location geo index', { err: error });
  }

  try {
    await Booking.collection.createIndex(
      { customerLocation: '2dsphere' },
      { name: 'customerLocation_2dsphere' }
    );
  } catch (error) {
    logger.error('Failed to ensure booking customer location geo index', { err: error });
  }
};

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      socketTimeoutMS: env.MONGODB_SOCKET_TIMEOUT_MS,
      connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
      maxIdleTimeMS: env.MONGODB_MAX_IDLE_TIME_MS,
      retryWrites: true,
      autoIndex: env.NODE_ENV !== 'production',
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB runtime error', { err: error });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    await ensureOperationalIndexes();

    logger.info('MongoDB connected', { host: conn.connection.host });
  } catch (error) {
    logger.error('MongoDB connection failed', { err: error });
    process.exit(1);
  }
};

export default connectDB;
