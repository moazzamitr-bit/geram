import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { CoreError } from "@/lib/core/types";
import { assertVerified } from "@/lib/kyc/verification";
import { createPhysicalRequest, listActiveProducts, listUserRequests } from "@/lib/physical/service";
import { loadPhysicalSettings } from "@/lib/physical/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const [settings, products, requests] = await Promise.all([
      loadPhysicalSettings(),
      listActiveProducts(),
      listUserRequests(userId),
    ]);
    return Response.json({
      ok: true,
      settings,
      products: products.filter((p) => p.active),
      requests,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    await assertVerified(userId);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.productId !== "string") throw new CoreError("invalid_product", "محصول را انتخاب کنید.");
    const settings = await loadPhysicalSettings();
    const row = await createPhysicalRequest({
      userId,
      productId: body.productId,
      quantity: Number(body.quantity ?? 1),
      branchId: String(body.branchId ?? ""),
      pickupDate: String(body.pickupDate ?? ""),
      pickupSlot: String(body.pickupSlot ?? ""),
      settings,
    });
    return Response.json({
      ok: true,
      request: row,
      message: `درخواست برداشت فیزیکی ثبت شد. کد پیگیری: ${row.tracking_code}`,
    });
  } catch (err) {
    return jsonError(err);
  }
}
