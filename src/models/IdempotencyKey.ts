import mongoose, { Document, Schema } from 'mongoose';

export type IdempotencyState = 'in-progress' | 'completed';

export interface IIdempotencyKey extends Document {
  key: string;
  state: IdempotencyState;
  statusCode?: number;
  body?: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const idempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    key: { type: String, required: true, unique: true, index: true },
    state: { type: String, enum: ['in-progress', 'completed'], required: true },
    statusCode: { type: Number },
    body: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IIdempotencyKey>('IdempotencyKey', idempotencyKeySchema);
