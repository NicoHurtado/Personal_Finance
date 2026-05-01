import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IHolding extends Document {
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  ticker: string;
  companyName: string;
  shares: number;
  costBasisPerShare: number;
  purchaseDate?: Date;
  createdAt: Date;
}

const HoldingSchema = new Schema<IHolding>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
  ticker: { type: String, required: true },
  companyName: { type: String, required: true },
  shares: { type: Number, required: true },
  costBasisPerShare: { type: Number, required: true },
  purchaseDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

HoldingSchema.index({ userId: 1, accountId: 1 });

export const Holding: Model<IHolding> =
  mongoose.models.Holding ||
  mongoose.model<IHolding>("Holding", HoldingSchema, "holdings");
