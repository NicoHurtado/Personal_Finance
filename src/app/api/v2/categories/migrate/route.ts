import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Category } from "@/models/Category";
import { TransactionV2 } from "@/models/TransactionV2";
import { GLOBAL_CATEGORY_SEEDS } from "@/lib/category-seeds";
import { apiError } from "@/lib/api-utils";

/**
 * POST /api/v2/categories/migrate
 * Replaces per-user / duplicated categories with a single global set (no userId).
 * Remaps transactions.categoryId by stable category key so assignments stay correct.
 */
export async function POST() {
  try {
    getCurrentUser();
    await connectDB();

    const oldCats = await Category.find({}).lean();
    const idToKey = new Map<string, string>();
    for (const c of oldCats) {
      if (c.key) idToKey.set(String(c._id), c.key);
    }

    await Category.deleteMany({});
    const inserted = await Category.insertMany([...GLOBAL_CATEGORY_SEEDS]);
    const keyToNewId = new Map<string, string>(
      inserted.map((doc) => [doc.key as string, String(doc._id)])
    );

    const txs = await TransactionV2.find({ categoryId: { $ne: null } })
      .select("_id categoryId")
      .lean();

    const ops = [];
    for (const t of txs) {
      const catId = t.categoryId as string;
      const key = idToKey.get(catId);
      const newId = key ? keyToNewId.get(key) : undefined;
      if (newId && newId !== catId) {
        ops.push({
          updateOne: {
            filter: { _id: t._id },
            update: { $set: { categoryId: newId } },
          },
        });
      } else if (!newId) {
        ops.push({
          updateOne: {
            filter: { _id: t._id },
            update: { $set: { categoryId: null } },
          },
        });
      }
    }

    let bulkResult = null;
    if (ops.length > 0) {
      bulkResult = await TransactionV2.bulkWrite(ops, { ordered: false });
    }

    return NextResponse.json({
      message: "Categories normalized to global set",
      categoriesCount: GLOBAL_CATEGORY_SEEDS.length,
      previousCategoryDocs: oldCats.length,
      transactionsUpdated: bulkResult?.modifiedCount ?? 0,
      transactionsCleared: ops.filter((o) => o.updateOne.update.$set.categoryId === null).length,
    });
  } catch (error) {
    return apiError(error);
  }
}
