import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IPortfolioAsset {
  ticker: string;
  name: string;
  percentage: number;
  groupId?: string;
}

export interface IPortfolioGroup {
  id: string;
  name: string;
  percentage: number;
  tickers: { ticker: string; weight: number }[];
}

export interface IPortfolioConfig extends Document {
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  assets: IPortfolioAsset[];
  groups: IPortfolioGroup[];
  updatedAt: Date;
}

const PortfolioAssetSchema = new Schema<IPortfolioAsset>(
  {
    ticker: { type: String, required: true },
    name: { type: String, required: true },
    percentage: { type: Number, required: true },
    groupId: String,
  },
  { _id: false }
);

const GroupTickerSchema = new Schema(
  { ticker: { type: String, required: true }, weight: { type: Number, required: true } },
  { _id: false }
);

const PortfolioGroupSchema = new Schema<IPortfolioGroup>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    percentage: { type: Number, required: true },
    tickers: { type: [GroupTickerSchema], default: [] },
  },
  { _id: false }
);

const PortfolioConfigSchema = new Schema<IPortfolioConfig>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
  assets: { type: [PortfolioAssetSchema], default: [] },
  groups: { type: [PortfolioGroupSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

PortfolioConfigSchema.index({ userId: 1, accountId: 1 }, { unique: true });

export const PortfolioConfig: Model<IPortfolioConfig> =
  mongoose.models.PortfolioConfig ||
  mongoose.model<IPortfolioConfig>("PortfolioConfig", PortfolioConfigSchema, "portfolio_configs");
