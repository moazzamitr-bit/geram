import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { assertVerified } from "@/lib/kyc/verification";
import { parseReportFilter, reportCsv, userReport } from "@/lib/reports/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await requireCoreUserId();
    await assertVerified(userId);
    const sp = new URL(request.url).searchParams;
    const filter = parseReportFilter(sp);
    const report = await userReport(userId, filter);
    if (sp.get("format") === "csv") {
      const name = `geram-report-${new Date().toISOString().slice(0, 10)}.csv`;
      return new Response(reportCsv(report.rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json({ ok: true, filter, ...report });
  } catch (err) {
    return jsonError(err);
  }
}
