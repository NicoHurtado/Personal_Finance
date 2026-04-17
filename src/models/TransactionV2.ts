import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ITransactionV2 extends Document {
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  date: Date;
  description: string;
  amount: number;
  type: "Expense" | "Payment" | "Income" | "Deposit" | "Withdrawal";
  categoryId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const TransactionV2Schema = new Schema<ITransactionV2>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
  date: { type: Date, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  type: {
    type: String,
    enum: ["Expense", "Payment", "Income", "Deposit", "Withdrawal"],
    required: true,
  },
  categoryId: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  createdAt: { type: Date, default: Date.now },
});

TransactionV2Schema.index({ userId: 1, accountId: 1, date: -1 });
TransactionV2Schema.index({ userId: 1, date: -1 });
TransactionV2Schema.index({ userId: 1, accountId: 1, type: 1 });

export const TransactionV2: Model<ITransactionV2> =
  mongoose.models.TransactionV2 ||
  mongoose.model<ITransactionV2>(
    "TransactionV2",
    TransactionV2Schema,
    "transactions"
  );
