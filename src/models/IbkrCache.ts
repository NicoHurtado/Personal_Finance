import mongoose, { Schema, Document, Model } from "mongoose";

export interface IIbkrCache extends Document {
  dateKey: string; // "YYYY-MM-DD"
  balanceUSD: number;
  fetchedAt: Date;
}

const IbkrCacheSchema = new Schema<IIbkrCache>({
  dateKey: { type: String, required: true, unique: true },
  balanceUSD: { type: Number, required: true },
  fetchedAt: { type: Date, default: Date.now },
});

export const IbkrCache: Model<IIbkrCache> =
  mongoose.models.IbkrCache ||
  mongoose.model<IIbkrCache>("IbkrCache", IbkrCacheSchema, "ibkr_cache");
