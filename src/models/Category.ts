import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICategory extends Document {
  userId: Types.ObjectId;
  name: string;
  color: string;
  key?: string;
  createdAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
  key: { type: String },
  createdAt: { type: Date, default: Date.now },
});

CategorySchema.index({ userId: 1 });

export const Category: Model<ICategory> =
  mongoose.models.Category ||
  mongoose.model<ICategory>("Category", CategorySchema, "categories");
