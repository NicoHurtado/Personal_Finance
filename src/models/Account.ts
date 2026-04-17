import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type AccountType =
  | "credit_card"
  | "debit"
  | "savings"
  | "fixed_income"
  | "brokerage";

export interface IAccountConfig {
  creditLimit?: number;
  annualRate?: number;
  anchorBalance?: number;
  anchorGrowth?: number;
  anchorDate?: Date;
  billingCutoffDay?: number;
  colorGradientEnd?: string;
}

export interface IAccount extends Document {
  userId: Types.ObjectId;
  slug: string;
  name: string;
  type: AccountType;
  currency: "COP" | "USD";
  icon: string;
  color: string;
  config: IAccountConfig;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
}

const AccountConfigSchema = new Schema<IAccountConfig>(
  {
    creditLimit: Number,
    annualRate: Number,
    anchorBalance: Number,
    anchorGrowth: Number,
    anchorDate: Date,
    billingCutoffDay: Number,
    colorGradientEnd: String,
  },
  { _id: false }
);

const AccountSchema = new Schema<IAccount>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  slug: { type: String, required: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ["credit_card", "debit", "savings", "fixed_income", "brokerage"],
    required: true,
  },
  currency: { type: String, enum: ["COP", "USD"], default: "COP" },
  icon: { type: String, default: "wallet" },
  color: { type: String, required: true },
  config: { type: AccountConfigSchema, default: () => ({}) },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

AccountSchema.index({ userId: 1, type: 1, active: 1 });
AccountSchema.index({ userId: 1, slug: 1 }, { unique: true });

export const Account: Model<IAccount> =
  mongoose.models.Account ||
  mongoose.model<IAccount>("Account", AccountSchema, "accounts");
