import mongoose from 'mongoose';
import env from './env';
import Worker from '../models/Worker';

const ensureOperationalIndexes = async (): Promise<void> => {
  try {
    await Worker.collection.createIndex(
      { location: '2dsphere' },
      { name: 'location_2dsphere' }
    );
  } catch (error) {
    console.error('Failed to ensure worker location geo index:', error);
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
      console.error('MongoDB runtime error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    await ensureOperationalIndexes();

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
