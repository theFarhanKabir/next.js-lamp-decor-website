import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

type ProfitItem = { unit_cost_bdt: number | string | null; quantity: number; line_total_bdt: number | string };
type ProfitOrder = { placed_at: string; order_items: ProfitItem[] };

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in with an administrator account." }, { status: 401 });
  if (user.app_metadata?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  const requestedYear = Number(new URL(request.url).searchParams.get("year"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
    ? requestedYear
    : new Date().getFullYear();
  const { data, error } = await supabase
    .from("orders")
    .select("placed_at, order_items(unit_cost_bdt,quantity,line_total_bdt)")
    .in("status", ["confirmed", "processing", "shipped", "delivered"])
    .gte("placed_at", `${year}-01-01T00:00:00.000Z`)
    .lt("placed_at", `${year + 1}-01-01T00:00:00.000Z`)
    .order("placed_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, revenue: 0, knownCost: 0, profit: 0, orderCount: 0, missingCostItems: 0 }));
  for (const order of (data ?? []) as unknown as ProfitOrder[]) {
    const month = new Date(order.placed_at).getUTCMonth();
    const bucket = months[month];
    bucket.orderCount += 1;
    for (const item of order.order_items ?? []) {
      const revenue = Number(item.line_total_bdt) || 0;
      bucket.revenue += revenue;
      if (item.unit_cost_bdt == null) bucket.missingCostItems += 1;
      else {
        bucket.knownCost += (Number(item.unit_cost_bdt) || 0) * item.quantity;
        bucket.profit += revenue - (Number(item.unit_cost_bdt) || 0) * item.quantity;
      }
    }
  }
  const totals = months.reduce((result, month) => ({
    revenue: result.revenue + month.revenue,
    knownCost: result.knownCost + month.knownCost,
    partialProfit: result.partialProfit + month.profit,
    orderCount: result.orderCount + month.orderCount,
    missingCostItems: result.missingCostItems + month.missingCostItems,
  }), { revenue: 0, knownCost: 0, partialProfit: 0, orderCount: 0, missingCostItems: 0 });

  return NextResponse.json({ year, months, totals: { ...totals, grossProfit: totals.missingCostItems ? null : totals.partialProfit }, source: "supabase" });
}
