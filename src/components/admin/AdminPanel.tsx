"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BadgePercent, BarChart3,
  Bell, Boxes, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  CircleHelp, CreditCard, Download, Ellipsis, Eye, FileImage, Filter, Gift,
  LayoutDashboard, ListFilter, LockKeyhole, Menu, MessageSquareText, Package,
  Plus, Search, Settings2, ShieldCheck, ShoppingBag, Sparkles, Tag, Trash2, TrendingUp,
  Users, X,
  type LucideIcon,
} from "lucide-react";
import { PRODUCTS } from "../../app/catalog";
import { apiFetch } from "../../lib/api";
import { createAdminClient as createSupabaseBrowserClient } from "../../lib/supabase/client";
import { DEFAULT_HOMEPAGE_CONTENT, type HomepageContent, type HeroSlide, type HomeCategory, type HotDeal } from "../../app/homepage-content";

const notifyStorefrontDataUpdated = () => window.dispatchEvent(new Event("storefront-data-updated"));

type PanelKey = "Overview" | "Orders" | "Custom requests" | "Products" | "Categories" | "Customers" | "Reviews" | "Coupons" | "Rewards" | "Media library" | "Homepage content" | "Analytics" | "Settings";
type OrderStatus = "Pending" | "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Refunded";
type StatusEvent = { id: string; from_status: string | null; to_status: string; actor_email: string; note: string | null; created_at: string };
type StoredOrder = { id: string; order_number: number; customer_name: string; customer_email: string; placed_at: string; total_bdt: number; payment_method: string | null; payment_status?: string; payment_refund_reference?: string | null; status: string; courier_status?: string; courier_tracking_code?: string | null; courier_return_status?: string | null; courier_return_request_id?: number | null; courier_message?: string | null; payment_transaction?: { status: string; risk_level: number | null } | null; order_status_events?: StatusEvent[]; order_items?: { quantity: number }[] };
type AdminOrderRow = { id: string; number: string; customer: string; email: string; date: string; items: number; total: number; status: OrderStatus; paymentStatus: string; paymentMethod: string; refundReference: string; method: string; courierStatus: string; trackingCode: string; returnStatus: string; events: StatusEvent[] };
type AdminReview = { id: string; product_slug: string | null; customer_name: string; rating: number; title: string | null; body: string; status: "pending" | "published" | "hidden"; created_at: string; admin_reply: string | null };
const orderStatuses: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded"];

type AdminSessionState = "checking" | "signed-out" | "not-admin" | "ready" | "unconfigured";

const navigation: { label: PanelKey; icon: LucideIcon; group: "Store" | "Engage" | "Manage" }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "Store" },
  { label: "Orders", icon: ShoppingBag, group: "Store" },
  { label: "Custom requests", icon: ClipboardList, group: "Store" },
  { label: "Products", icon: Package, group: "Store" },
  { label: "Categories", icon: Boxes, group: "Store" },
  { label: "Customers", icon: Users, group: "Engage" },
  { label: "Reviews", icon: MessageSquareText, group: "Engage" },
  { label: "Coupons", icon: BadgePercent, group: "Engage" },
  { label: "Rewards", icon: Gift, group: "Engage" },
  { label: "Media library", icon: FileImage, group: "Manage" },
  { label: "Homepage content", icon: Sparkles, group: "Manage" },
  { label: "Analytics", icon: BarChart3, group: "Manage" },
  { label: "Settings", icon: Settings2, group: "Manage" },
];

type CustomRequestRecord = {
  id: string;
  request_number: number | string;
  full_name: string;
  phone: string;
  email: string | null;
  city_area: string;
  delivery_address: string;
  description: string;
  status: string;
  admin_note?: string | null;
  quoted_price_bdt?: number | null;
  custom_request_status_events?: StatusEvent[];
  created_at: string;
  images: { id: string; file_name: string; signed_url?: string | null }[];
};

const demoRequests: CustomRequestRecord[] = [
  { id: "demo-1", request_number: "CR-2036", full_name: "Nadia Rahman", phone: "+880 1712-345678", email: "nadia.r@email.com", city_area: "Gulshan, Dhaka", delivery_address: "Road 12, Gulshan 1, Dhaka", description: "I would love a pair of bedside lamps inspired by the attached reference. Please make the base in warm walnut and keep the shade in a natural linen tone. The lamps should work with warm LED bulbs.", status: "new", created_at: "2026-10-08T08:20:00.000Z", images: [{ id: "demo-1-a", file_name: "bedside-lamp-reference.jpg", signed_url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80" }, { id: "demo-1-b", file_name: "linen-shade-inspiration.jpg", signed_url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80" }] },
  { id: "demo-2", request_number: "CR-2035", full_name: "Samir Hossain", phone: "+880 1811-223344", email: "samir.h@email.com", city_area: "Dhanmondi, Dhaka", delivery_address: "House 8, Road 4, Dhanmondi, Dhaka", description: "Could you make an arched full-length mirror with a slim antique brass frame? I have a 30 inch wide wall space and would like the proportions to feel similar to the photo.", status: "reviewing", created_at: "2026-10-07T13:45:00.000Z", images: [{ id: "demo-2-a", file_name: "arched-mirror-reference.png", signed_url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80" }] },
  { id: "demo-3", request_number: "CR-2034", full_name: "Ayesha Karim", phone: "+880 1912-987654", email: "ayesha.k@email.com", city_area: "Banani, Dhaka", delivery_address: "Block C, Banani, Dhaka", description: "I am looking for a round dining table for six in a medium oak finish. Please share a quote and let me know if the pedestal base in my reference can be made.", status: "new", created_at: "2026-10-06T09:10:00.000Z", images: [] },
];

const money = (amount: number) => `৳${amount.toLocaleString("en-BD")}`;

function Button({ children, variant = "primary", onClick, className = "", type = "button", disabled = false }: { children: React.ReactNode; variant?: "primary" | "secondary" | "quiet"; onClick?: () => void; className?: string; type?: "button" | "submit"; disabled?: boolean }) {
  const style = variant === "primary"
    ? "bg-[#171717] text-white hover:bg-[#333333] shadow-none"
    : variant === "secondary"
      ? "border border-[#e8e0d4] bg-white text-[#34312c] hover:bg-white"
      : "text-[#746d63] hover:bg-white hover:text-[#282722]";
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-[12px] font-semibold transition disabled:cursor-wait disabled:opacity-50 ${style} ${className}`}>{children}</button>;
}

function StatusPill({ children }: { children: string }) {
  const tone = children === "Delivered" || children === "Published" || children === "Active"
    ? "bg-[#edf4ed] text-[#547456]"
    : children === "Processing" || children === "Pending" || children === "Draft"
      ? "bg-[#fff3df] text-[#a8792f]"
      : children === "Cancelled" || children === "Archived"
        ? "bg-[#f8e9e6] text-[#a45e51]"
        : "bg-[#edf0f4] text-[#657386]";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{children}</span>;
}

function PanelCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[#e5e5e5] bg-white shadow-none ${className}`}>{children}</section>;
}

function SectionHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-[25px] font-semibold tracking-[-0.035em] text-black">{title}</h1><p className="mt-1.5 text-[12px] text-[#737373]">{description}</p></div>{action}</div>;
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="flex h-10 min-w-0 items-center gap-2.5 rounded-lg border border-[#e9e4dc] bg-white px-3 text-[#9b9388] focus-within:border-[#c9a06a]"><Search size={15} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[12px] text-[#34312c] outline-none placeholder:text-[#aaa399]" /></label>;
}

type OverviewData = {
  summary: { productCount: number; orderCount: number; customerCount: number; pendingOrderCount: number; monthOrderCount: number; monthRevenueBdt: number };
  recentOrders: StoredOrder[];
};

function Overview({ onNavigate }: { onNavigate: (page: PanelKey) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch("/api/admin/overview", { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Store overview could not be loaded.");
      return result as OverviewData;
    }).then((result) => { if (active) setData(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Store overview could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const summary = data?.summary;
  const cards = [
    { label: "Products", value: summary?.productCount ?? 0, icon: Package, action: "Products" as PanelKey },
    { label: "Orders", value: summary?.orderCount ?? 0, icon: ShoppingBag, action: "Orders" as PanelKey },
    { label: "Customers", value: summary?.customerCount ?? 0, icon: Users, action: "Customers" as PanelKey },
    { label: "Pending orders", value: summary?.pendingOrderCount ?? 0, icon: Activity, action: "Orders" as PanelKey },
  ];
  return <>
    <SectionHeading title="Overview" description="Live totals from your Supabase store." action={<Button variant="secondary" onClick={() => onNavigate("Analytics")}><BarChart3 size={14} /> Sales report</Button>} />
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{error}</p>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, action }) => <button type="button" key={label} onClick={() => onNavigate(action)} className="rounded-xl border border-[#ece6dd] bg-white p-4 text-left transition hover:border-[#d8c6aa]"><div className="flex items-center justify-between"><p className="text-[10px] text-[#8f887e]">{label}</p><Icon size={15} className="text-[#a77b43]" /></div><p className="mt-3 text-[22px] font-semibold text-[#34312c]">{loading ? "?" : value.toLocaleString()}</p></button>)}</div>
    <div className="mb-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <PanelCard className="p-5"><div className="flex items-start justify-between"><div><h2 className="text-[13px] font-semibold text-[#34312c]">This month</h2><p className="mt-1 text-[10px] text-[#a09a90]">Confirmed through delivered orders</p></div><TrendingUp size={17} className="text-[#9aaf8c]" /></div><p className="mt-5 text-[28px] font-semibold text-[#34312c]">{loading ? "?" : money(Math.round((summary?.monthRevenueBdt ?? 0) * 100))}</p><p className="mt-2 text-[10px] text-[#8f887e]">{summary?.monthOrderCount ?? 0} qualifying orders ? product sales before delivery fees</p></PanelCard>
      <PanelCard className="p-5"><h2 className="text-[13px] font-semibold text-[#34312c]">Quick actions</h2><div className="mt-4 grid grid-cols-2 gap-2">{([["Products", Package], ["Categories", Boxes], ["Homepage content", Sparkles], ["Orders", ShoppingBag]] as const).map(([label, Icon]) => <button type="button" key={label} onClick={() => onNavigate(label)} className="flex items-center gap-2 rounded-lg border border-[#eee8de] p-3 text-left text-[10px] font-medium text-[#625d55] hover:bg-[#faf9f7]"><Icon size={14} className="text-[#a77b43]" />{label}</button>)}</div></PanelCard>
    </div>
    <PanelCard className="overflow-hidden"><div className="flex items-center justify-between border-b border-[#f0ece6] px-5 py-4"><div><h2 className="text-[13px] font-semibold text-[#34312c]">Recent orders</h2><p className="mt-1 text-[10px] text-[#a09a90]">Latest orders saved in the database</p></div><button type="button" onClick={() => onNavigate("Orders")} className="text-[11px] font-semibold text-[#9b6b38] hover:text-[#6f4c28]">View all <ArrowUpRight className="ml-1 inline" size={13} /></button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left"><thead><tr className="bg-white text-[9px] uppercase tracking-[.11em] text-[#948c80]"><th className="px-5 py-3 font-semibold">Order</th><th className="px-3 py-3 font-semibold">Customer</th><th className="px-3 py-3 font-semibold">Total</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody>{data?.recentOrders.map((order) => <tr key={order.id} className="border-t border-[#f3f0ea] text-[11px]"><td className="px-5 py-3 font-semibold text-[#48443d]">CL-{order.order_number}<p className="mt-1 text-[9px] font-normal text-[#a19a90]">{new Date(order.placed_at).toLocaleDateString("en-BD")}</p></td><td className="px-3 py-3 text-[#5a554d]">{order.customer_name}</td><td className="px-3 py-3 font-medium text-[#38352f]">{money(Math.round(Number(order.total_bdt) * 100))}</td><td className="px-5 py-3"><StatusPill>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</StatusPill></td></tr>)}</tbody></table></div>
      {loading && <p role="status" className="p-8 text-center text-xs text-[#928a7f]">Loading overview...</p>}{!loading && !data?.recentOrders.length && <p className="p-8 text-center text-xs text-[#928a7f]">No orders have been saved yet.</p>}
    </PanelCard>
  </>;
}

function OrdersPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All orders");
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [courierBusyId, setCourierBusyId] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  const [refundOrder, setRefundOrder] = useState<AdminOrderRow | null>(null);
  const [refundReference, setRefundReference] = useState("");
  const [refundConfirmed, setRefundConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch("/api/admin/orders", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Orders could not be loaded.");
        return result.orders as StoredOrder[];
      })
      .then((orders) => {
        if (!active) return;
        setRows((orders ?? []).map((order) => ({
          id: order.id,
          number: "CL-" + order.order_number,
          customer: order.customer_name,
          email: order.customer_email,
          date: new Date(order.placed_at).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "2-digit" }),
          items: (order.order_items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          total: Math.round(Number(order.total_bdt || 0) * 100),
          status: (order.status.charAt(0).toUpperCase() + order.status.slice(1)) as OrderStatus,
          paymentStatus: order.payment_status ?? "pending",
          paymentMethod: order.payment_method ?? "",
          refundReference: order.payment_refund_reference ?? "",
          method: order.payment_method === "cod" ? "Cash on delivery" : order.payment_method === "bkash"
            ? `bKash · ${order.payment_transaction?.status ?? order.payment_status ?? "pending"}${order.payment_transaction?.risk_level === 1 ? " · risk review" : ""}`
            : order.payment_method === "card"
              ? `Card · ${order.payment_transaction?.status ?? order.payment_status ?? "pending"}${order.payment_transaction?.risk_level === 1 ? " · risk review" : ""}`
              : "Not set",
          courierStatus: order.courier_status ?? "not_submitted",
          trackingCode: order.courier_tracking_code ?? "",
          returnStatus: order.courier_return_status ?? "",
          events: [...(order.order_status_events ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        })));
        setError("");
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Orders could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateStatus = async (id: string, status: OrderStatus) => {
    setSavingId(id);
    setError("");
    setStatusNotice("");
    try {
      const response = await apiFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: status.toLowerCase() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The order status could not be updated.");
      setRows((current) => current.map((row) => row.id === id ? { ...row, status, events: [{ id: crypto.randomUUID(), from_status: row.status.toLowerCase(), to_status: status.toLowerCase(), actor_email: "You", note: null, created_at: new Date().toISOString() }, ...row.events] } : row));
      setStatusNotice(`${status} saved for ${rows.find((row) => row.id === id)?.number ?? "order"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The order status could not be updated.");
    } finally {
      setSavingId("");
    }
  };

  const openRefund = (order: AdminOrderRow) => {
    setRefundOrder(order);
    setRefundReference("");
    setRefundConfirmed(false);
  };

  const recordRefund = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const order = refundOrder;
    const reference = refundReference.trim();
    if (!order || !reference || !refundConfirmed) return;
    setSavingId(order.id); setError(""); setStatusNotice("");
    try {
      const response = await apiFetch("/api/admin/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, action: "record_refund", reference }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The refund could not be recorded.");
      setRows((current) => current.map((row) => row.id === order.id ? { ...row, status: "Refunded", paymentStatus: "refunded", refundReference: reference, events: [{ id: crypto.randomUUID(), from_status: row.status.toLowerCase(), to_status: "refunded", actor_email: "You", note: "Refund recorded", created_at: new Date().toISOString() }, ...row.events] } : row));
      setStatusNotice(`Refund recorded for ${order.number}.`);
      setRefundOrder(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The refund could not be recorded."); }
    finally { setSavingId(""); }
  };

  const allowedStatuses = (order: AdminOrderRow): OrderStatus[] => {
    if (order.status === "Pending") {
      const next: OrderStatus[] = [];
      if (order.paymentMethod === "cod" || order.paymentStatus === "paid") next.push("Confirmed");
      if (!order.trackingCode) next.push("Cancelled");
      return next;
    }
    if (order.status === "Confirmed") {
      const next: OrderStatus[] = [];
      if (order.paymentMethod === "cod" || order.paymentStatus === "paid") next.push("Processing");
      if (!order.trackingCode) next.push("Cancelled");
      return next;
    }
    if (order.status === "Processing") return order.trackingCode ? ["Shipped"] : ["Cancelled"];
    if (order.status === "Shipped") return ["delivered", "partial_delivered"].includes(order.courierStatus) ? ["Delivered"] : [];
    return [];
  };

  const updateCourier = async (order: AdminOrderRow, requestedAction?: "return") => {
    setCourierBusyId(order.id);
    setError("");
    const action = requestedAction ?? (["not_submitted", "failed"].includes(order.courierStatus) ? "create" : "sync");
    try {
      const response = await apiFetch("/api/admin/orders/steadfast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Courier status could not be updated.");
      setRows((current) => current.map((row) => row.id === order.id ? {
        ...row,
        status: result.orderStatus ? (result.orderStatus.charAt(0).toUpperCase() + result.orderStatus.slice(1)) as OrderStatus : row.status,
        paymentStatus: result.paymentStatus ?? row.paymentStatus,
        events: result.events ? [...result.events].sort((a: StatusEvent, b: StatusEvent) => b.created_at.localeCompare(a.created_at)) : row.events,
        courierStatus: result.courier_status ?? result.courierStatus ?? row.courierStatus,
        trackingCode: result.trackingCode ?? row.trackingCode,
        returnStatus: result.courier_return_status ?? result.returnStatus ?? row.returnStatus,
      } : row));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Courier status could not be updated.");
    } finally {
      setCourierBusyId("");
    }
  };

  const filtered = rows.filter((order) =>
    [order.number, order.customer, order.email].join(" ").toLowerCase().includes(query.toLowerCase())
    && (filter === "All orders" || order.status === filter));

  return <>
    <SectionHeading title="Orders" description="Review, fulfill, and keep track of saved customer orders." action={<Button variant="secondary" onClick={() => window.print()}><Download size={14} /> Print</Button>} />
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{error}</p>}
    {statusNotice && <p role="status" className="mb-4 rounded-lg border border-[#dce8d8] bg-[#f2f7ef] p-3 text-[11px] text-[#587052]">{statusNotice}</p>}
    <PanelCard>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#f0ece6] p-4">
        <div className="w-full sm:max-w-[300px]"><SearchField value={query} onChange={setQuery} placeholder="Search by order or customer?" /></div>
        <div className="flex flex-1 justify-end gap-2">
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#5a554d] outline-none">
            <option>All orders</option>{orderStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[1040px] text-left">
          <thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Order", "Customer", "Date", "Items", "Total", "Payment", "Status", "Courier"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody>
            {filtered.map((order) => <tr key={order.id} className="border-t border-[#f3f0ea] text-[11px] hover:bg-white">
              <td className="px-4 py-4 font-semibold text-[#48443d]">{order.number}</td>
              <td className="px-4 py-4"><p className="font-medium text-[#48443d]">{order.customer}</p><p className="mt-1 text-[9px] text-[#9c958a]">{order.email}</p></td>
              <td className="px-4 py-4 text-[#756f65]">{order.date}</td>
              <td className="px-4 py-4 text-[#756f65]">{order.items} items</td>
              <td className="px-4 py-4 font-semibold text-[#48443d]">{money(order.total)}</td>
              <td className="px-4 py-4 text-[#756f65]"><span>{order.method}</span><span className="mt-1 block text-[9px] capitalize">Payment: {order.paymentStatus.replaceAll("_", " ")}</span>{order.paymentStatus === "paid" && ["Delivered", "Cancelled"].includes(order.status) && <button type="button" disabled={savingId === order.id} onClick={() => openRefund(order)} className="mt-1 rounded border border-[#e9e4dc] px-2 py-1 text-[9px] text-[#8d6437] disabled:opacity-50">Record refund</button>}</td>
              <td className="px-4 py-4"><select aria-label={"Status for " + order.number} disabled={savingId === order.id || allowedStatuses(order).length === 0} value={order.status} onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)} className="rounded-md border border-[#e9e4dc] bg-white px-2 py-1.5 text-[10px] text-[#48443d] disabled:opacity-60"><option value={order.status}>{order.status}</option>{allowedStatuses(order).map((status) => <option key={status}>{status}</option>)}</select>{order.events[0] && <p className="mt-1 max-w-[150px] text-[9px] text-[#928a7e]">Updated {new Date(order.events[0].created_at).toLocaleString("en-BD")} by {order.events[0].actor_email}</p>}{order.paymentStatus === "refunded" && order.refundReference && <p className="mt-1 text-[9px] text-[#587052]">Refund ref: {order.refundReference}</p>}</td>
              <td className="px-4 py-3"><div className="text-[9px] text-[#625d55]">{order.courierStatus.replaceAll("_", " ")}</div>{order.trackingCode && <div className="mt-1 font-mono text-[9px] text-[#8d6437]">{order.trackingCode}</div>}{order.returnStatus && <div className="mt-1 text-[9px] text-[#716a60]">Return: {order.returnStatus.replaceAll("_", " ")}</div>}<button type="button" disabled={courierBusyId === order.id} onClick={() => void updateCourier(order)} className="mt-1.5 rounded border border-[#e9e4dc] px-2 py-1 text-[9px] text-[#6e5737] disabled:opacity-50">{courierBusyId === order.id ? "Working…" : ["not_submitted", "failed"].includes(order.courierStatus) ? "Create shipment" : "Sync status"}</button>{["delivered", "partial_delivered"].includes(order.courierStatus) && !order.returnStatus && <button type="button" disabled={courierBusyId === order.id} onClick={() => void updateCourier(order, "return")} className="ml-1.5 mt-1.5 rounded border border-[#e9e4dc] px-2 py-1 text-[9px] text-[#6e5737] disabled:opacity-50">Request return</button>}</td>
            </tr>)}
          </tbody>
        </table>
        {loading && <div role="status" className="p-10 text-center text-xs text-[#928a7f]">Loading orders...</div>}
        {!loading && filtered.length === 0 && <div className="p-10 text-center text-xs text-[#928a7f]">{error ? "Orders are unavailable." : "No matching orders."}</div>}
      </div>
      <div className="space-y-3 p-3 sm:hidden">
        {filtered.map((order) => <article key={order.id} className="min-w-0 rounded-lg border border-[#eee8df] p-3">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-semibold text-[#48443d]">{order.number}</p><p className="mt-1 break-words text-[12px] font-medium text-[#34312c]">{order.customer}</p><p className="mt-1 break-all text-[10px] text-[#8c857b]">{order.email}</p></div><p className="shrink-0 text-[11px] font-semibold text-[#48443d]">{money(order.total)}</p></div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8c857b]"><span>{order.date}</span><span>{order.items} items</span><span>{order.method}</span></div>
          <p className="mt-3 text-[10px] text-[#716a60]">Payment: <span className="capitalize">{order.paymentStatus}</span></p><label className="mt-3 block text-[10px] font-medium text-[#716a60]">Order status<select aria-label={"Status for " + order.number} disabled={savingId === order.id || allowedStatuses(order).length === 0} value={order.status} onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)} className="mt-1.5 h-11 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[12px] text-[#48443d] disabled:opacity-60"><option value={order.status}>{order.status}</option>{allowedStatuses(order).map((status) => <option key={status}>{status}</option>)}</select></label>{order.events[0] && <p className="mt-2 text-[9px] text-[#928a7e]">Updated {new Date(order.events[0].created_at).toLocaleString("en-BD")} by {order.events[0].actor_email}</p>}{order.paymentStatus === "paid" && ["Delivered", "Cancelled"].includes(order.status) && <button type="button" disabled={savingId === order.id} onClick={() => openRefund(order)} className="mt-2 min-h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] font-medium text-[#8d6437] disabled:opacity-50">Record refund</button>}
          <div className="mt-3 rounded-lg bg-[#f8f6f2] p-3"><p className="text-[10px] font-medium capitalize text-[#625d55]">Courier: {order.courierStatus.replaceAll("_", " ")}</p>{order.trackingCode && <p className="mt-1 break-all font-mono text-[10px] text-[#8d6437]">{order.trackingCode}</p>}{order.returnStatus && <p className="mt-1 text-[10px] text-[#716a60]">Return: {order.returnStatus.replaceAll("_", " ")}</p>}<button type="button" disabled={courierBusyId === order.id} onClick={() => void updateCourier(order)} className="mt-2 min-h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] font-medium text-[#6e5737] disabled:opacity-50">{courierBusyId === order.id ? "Working…" : ["not_submitted", "failed"].includes(order.courierStatus) ? "Create shipment" : "Sync status"}</button>{["delivered", "partial_delivered"].includes(order.courierStatus) && !order.returnStatus && <button type="button" disabled={courierBusyId === order.id} onClick={() => void updateCourier(order, "return")} className="mt-2 min-h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] font-medium text-[#6e5737] disabled:opacity-50">Request return</button>}</div>
        </article>)}
        {loading && <div role="status" className="p-8 text-center text-xs text-[#928a7f]">Loading orders...</div>}
        {!loading && filtered.length === 0 && <div className="p-8 text-center text-xs text-[#928a7f]">{error ? "Orders are unavailable." : "No matching orders."}</div>}
      </div>
      <div className="flex items-center justify-between border-t border-[#f0ece6] px-4 py-3 text-[10px] text-[#958e83]">Showing {filtered.length} of {rows.length} orders</div>
    </PanelCard>
    {refundOrder && <div role="presentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && savingId !== refundOrder.id) setRefundOrder(null); }}><form role="dialog" aria-modal="true" aria-labelledby="refund-title" onSubmit={recordRefund} className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl sm:p-6"><h2 id="refund-title" className="text-base font-semibold text-[#282722]">Record refund · {refundOrder.number}</h2><p className="mt-2 text-[11px] leading-5 text-[#716a60]">First complete the refund through your payment provider or manual payment channel. This action records its result in your store; it does not move money.</p>{error && <p role="alert" className="mt-3 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{error}</p>}<label className="mt-4 block text-[10px] font-medium text-[#716a60]">Refund transaction reference<input required maxLength={120} value={refundReference} onChange={(event) => setRefundReference(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] px-3 text-[11px] outline-none focus:border-[#c9a06a]" /></label><label className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-[#625d55]"><input required type="checkbox" checked={refundConfirmed} onChange={(event) => setRefundConfirmed(event.target.checked)} className="mt-0.5" />I confirm the refund has completed and this reference is from the payment provider or bank.</label><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setRefundOrder(null)} disabled={savingId === refundOrder.id}>Cancel</Button><Button type="submit" disabled={savingId === refundOrder.id || !refundReference.trim() || !refundConfirmed}>{savingId === refundOrder.id ? "Saving…" : "Record completed refund"}</Button></div></form></div>}
  </>;
}

type AdminProduct = { id: string; name: string; category: string; subcategory: string; category_slug?: string; subcategory_slug?: string; status: string; price_bdt: number; inventory_quantity: number; sku?: string; slug: string; product_images?: { public_url: string }[] };
type ProductSwatch = { label: string; color: string; imageUrl: string };

function ProductsPage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", sku: "", category_slug: "lamps", subcategory_name: "Table Lamps", short_description: "", description: "", price_bdt: "", cost_price_bdt: "", compare_at_price_bdt: "", inventory_quantity: "0", status: "draft", promotion: "", made_to_order: false, lead_time: "", width: "", depth: "", height: "", top: "", weight: "", materials: "", finish: "", assembly: "", care: "", warranty: "", sizes: "Small:0, Medium:6400, Large:12000", images: "", special_edition: false });
  const [sizeDimensions, setSizeDimensions] = useState<Record<string, Record<string, string>>>({});
  const [swatches, setSwatches] = useState<ProductSwatch[]>([{ label: "Natural Oak", color: "#c8a96e", imageUrl: "" }]);
  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/admin/products", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load products.");
      setProducts(result.products.map((p: any) => ({ ...p, id: p.slug, category_slug: p.category?.slug, subcategory_slug: p.subcategory?.slug, category: p.category?.name ?? "", subcategory: p.subcategory?.name ?? "" })));
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load products."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const rows = products.filter((p) => `${p.name} ${p.category} ${p.subcategory} ${p.slug} ${p.sku ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const editProduct = (product: any) => {
    const attrs = product.attributes ?? {};
    const options = (list: any[]) => (list ?? []).map((option) => `${option.label}:${option.delta ?? 0}`).join(", ");
    const dimensions = typeof attrs.dimensions === "object" && attrs.dimensions ? attrs.dimensions : {};
    const details = attrs.materialDetails ?? {};
    setSizeDimensions(attrs.sizeDimensions && typeof attrs.sizeDimensions === "object" ? attrs.sizeDimensions : {});
    setForm({ name: product.name, slug: product.slug, sku: product.sku ?? "", category_slug: product.category_slug ?? "lamps", subcategory_name: product.subcategory ?? "", short_description: product.short_description ?? "", description: product.description ?? "", price_bdt: String(product.price_bdt ?? ""), cost_price_bdt: product.cost_price_bdt == null ? "" : String(product.cost_price_bdt), compare_at_price_bdt: String(product.compare_at_price_bdt ?? ""), inventory_quantity: String(product.inventory_quantity ?? 0), status: product.status ?? "draft", promotion: attrs.badge === "new" || attrs.badge === "sale" ? attrs.badge : "", made_to_order: Boolean(product.made_to_order), lead_time: product.lead_time ?? "", width: dimensions.width ?? "", depth: dimensions.depth ?? "", height: dimensions.height ?? "", top: dimensions.top ?? "", weight: dimensions.weight ?? "", materials: (attrs.materials ?? []).join(", "), finish: details.finish ?? "", assembly: details.assembly ?? "", care: details.care ?? "", warranty: details.warranty ?? "", sizes: options(attrs.sizes), images: (product.product_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((image: any) => image.public_url).join("\n"), special_edition: Boolean(attrs.special_edition) });
    setSwatches((product.swatches ?? []).map((swatch: any) => ({ label: swatch.label ?? "", color: swatch.color ?? "#c8a96e", imageUrl: swatch.imageUrl ?? "" })));
    setNotice(""); setEditing(true);
  };
  const field = (key: keyof typeof form, label: string, placeholder = "", type = "text") => <label className="block text-[10px] font-medium text-[#716a60]">{label}<input type={type} value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]" /></label>;
  const parseOptions = (value: string) => value.split(",").map((item) => { const [label, delta] = item.split(":"); return { label: label.trim(), delta: Number(delta) || 0 }; }).filter((item) => item.label);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice(""); setNoticeIsError(false);
    const configuredSizes = parseOptions(form.sizes);
    const sizeDimensionsToSave = Object.fromEntries(configuredSizes.map(({ label }) => [label, Object.fromEntries((["width", "depth", "height", "top", "weight"] as const).filter((key) => sizeDimensions[label]?.[key]?.trim()).map((key) => [key, sizeDimensions[label][key].trim()]))]).filter(([, dimensions]) => Object.keys(dimensions as object).length > 0));
    const attributes = { dimensions: Object.fromEntries((["width", "depth", "height", "top", "weight"] as const).filter((key) => form[key].trim()).map((key) => [key, form[key].trim()])), sizeDimensions: sizeDimensionsToSave, materials: form.materials.split(",").map((x) => x.trim()).filter(Boolean), materialDetails: Object.fromEntries((["finish", "assembly", "care", "warranty"] as const).filter((key) => form[key].trim()).map((key) => [key, form[key].trim()])), sizes: configuredSizes, badge: form.promotion || null, special_edition: form.special_edition };
    const imageUrls = form.images.split(/\n|,/).map((url) => url.trim()).filter(Boolean);
    try {
      const response = await apiFetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, attributes, swatches: swatches.filter((swatch) => swatch.label.trim()).map(({ label, color, imageUrl }) => ({ label: label.trim(), color, ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}) })), images: imageUrls.map((url, index) => ({ url, role: index ? "lifestyle" : "product", alt: form.name })) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Product could not be saved.");
      setNotice(form.status === "active"
        ? "Product saved and published in Supabase. It should now be available on the storefront."
        : form.status === "archived"
          ? "Product saved as archived in Supabase. It is hidden from the storefront until you publish it again."
          : "Product saved to Supabase as a draft. It will not appear on the storefront until you enable Publish immediately or change its status to Active.");
      setNoticeIsError(false); setEditing(false); notifyStorefrontDataUpdated(); await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Product could not be saved.";
      const lowerMessage = message.toLowerCase();
      const actionableMessage = /administrator access is required|administrator account/.test(lowerMessage)
        ? "Product was not saved: this account does not have the trusted Supabase admin role. Grant app_metadata.role = admin to this user's account, then sign out and sign in again."
        : /sign in to continue|sign in with/.test(lowerMessage)
          ? "Product was not saved: the backend did not receive a signed-in Supabase session. Sign in again on /admin, then retry."
          : /supabase.*not connected|server key is not connected/.test(lowerMessage)
            ? "Product was not saved: the backend's server-only Supabase key is missing or invalid. Check SUPABASE_SECRET_KEY in the backend environment."
            : message;
      setNotice(actionableMessage); setNoticeIsError(true);
    }
    finally { setSaving(false); }
  };
  const changeStatus = async (slug: string, status: string) => {
    const response = await apiFetch("/api/admin/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, status }) });
    const result = await response.json(); if (!response.ok) setError(result.error || "Status update failed."); else { notifyStorefrontDataUpdated(); await load(); }
  };
  const deleteProduct = async (product: AdminProduct) => {
    if (!window.confirm(`Permanently delete ${product.name}? Products with orders or reviews must be archived instead.`)) return;
    setDeletingSlug(product.slug); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/admin/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: product.slug }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Product could not be deleted.");
      notifyStorefrontDataUpdated();
      await load();
      setNotice(result.warning || "Product deleted from the catalogue.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Product could not be deleted."); }
    finally { setDeletingSlug(""); }
  };
  const uploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setNotice("Configure Supabase before uploading product images."); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Use JPG, PNG, WebP, or AVIF images up to 10 MB.");
        const path = `products/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        const { error } = await supabase.storage.from("store-media").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        urls.push(supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl);
      }
      setForm((current) => ({ ...current, images: [current.images, ...urls].filter(Boolean).join("\n") }));
      setNotice(`${urls.length} image${urls.length === 1 ? "" : "s"} uploaded.`);
    } catch (err) { setNotice(err instanceof Error ? err.message : "Image upload failed."); }
    finally { setUploading(false); }
  };
  const uploadSwatchImage = async (index: number, file?: File) => {
    if (!file) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setNotice("Configure Supabase before uploading product images."); return; }
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setNotice("Use JPG, PNG, WebP, or AVIF images up to 10 MB."); return; }
    setUploading(true);
    try {
      const path = `products/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error } = await supabase.storage.from("store-media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const imageUrl = supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
      setSwatches((current) => current.map((swatch, row) => row === index ? { ...swatch, imageUrl } : swatch));
      setNotice("Colour image uploaded.");
    } catch (err) { setNotice(err instanceof Error ? err.message : "Image upload failed."); }
    finally { setUploading(false); }
  };
  const beginNewProduct = () => {
    setForm({ name: "", slug: "", sku: "", category_slug: "lamps", subcategory_name: "Table Lamps", short_description: "", description: "", price_bdt: "", cost_price_bdt: "", compare_at_price_bdt: "", inventory_quantity: "0", status: "draft", promotion: "", made_to_order: false, lead_time: "", width: "", depth: "", height: "", top: "", weight: "", materials: "", finish: "", assembly: "", care: "", warranty: "", sizes: "Small:0, Medium:6400, Large:12000", images: "", special_edition: false });
    setSizeDimensions({});
    setSwatches([{ label: "Natural Oak", color: "#c8a96e", imageUrl: "" }]); setNotice(""); setNoticeIsError(false); setEditing(true);
  };
  return <><SectionHeading title="Products" description="Manage product details, options, inventory, and storefront visibility." action={<Button onClick={beginNewProduct}><Plus size={15} /> Add product</Button>} />
    {error && <div role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-4 text-[12px] text-[#8f493b]">{error}{/administrator/i.test(error) && <p className="mt-1 text-[10px]">Grant this account the trusted app_metadata.role = admin claim, then sign in again.</p>}{/not configured/i.test(error) && <p className="mt-1 text-[10px]">Check the frontend Supabase URL and publishable key, backend server key, and database migrations.</p>}</div>}
    {notice && <div role={noticeIsError ? "alert" : "status"} className={`mb-4 rounded-lg border p-3 text-[11px] ${noticeIsError ? "border-[#ead4ca] bg-[#fff5f0] text-[#8f493b]" : "border-[#dce8d8] bg-[#f2f7ef] text-[#587052]"}`}>{notice}</div>}
    <PanelCard><div className="flex flex-wrap items-center gap-2 border-b border-[#f0ece6] p-4"><div className="w-full sm:max-w-[320px]"><SearchField value={query} onChange={setQuery} placeholder="Search products or SKU…" /></div><span className="ml-auto text-[10px] text-[#9a9388]">{loading ? "Loading…" : `${rows.length} products in Supabase`}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Product", "Category", "Price", "Inventory", "Status", "Storefront", ""].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{rows.map((p) => <tr key={p.id} className="border-t border-[#f3f0ea] text-[11px]"><td className="px-4 py-3"><div className="flex items-center gap-3">{p.product_images?.[0]?.public_url && <img src={p.product_images[0].public_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}<div><p className="font-semibold">{p.name}</p><p className="mt-1 text-[9px] text-[#9c958a]">{p.sku || p.slug}</p></div></div></td><td className="px-4 py-3">{p.category} · {p.subcategory}</td><td className="px-4 py-3">{money(Number(p.price_bdt))}</td><td className="px-4 py-3">{p.inventory_quantity}</td><td className="px-4 py-3"><StatusPill>{p.status === "active" ? "Active" : p.status === "archived" ? "Archived" : "Draft"}</StatusPill></td><td className="px-4 py-3"><select value={p.status} onChange={(e) => void changeStatus(p.slug, e.target.value)} className="rounded border border-[#e9e4dc] bg-white p-2 text-[10px]"><option value="draft">Draft</option><option value="active">Publish</option><option value="archived">Archive</option></select></td><td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => editProduct(p)} className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#8d6437] hover:bg-white">Edit</button><button disabled={deletingSlug === p.slug} onClick={() => void deleteProduct(p)} className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#9d5548] hover:bg-[#fbefec] disabled:opacity-50">{deletingSlug === p.slug ? "Deleting..." : "Delete"}</button></div></td></tr>)}</tbody></table>{!loading && rows.length === 0 && <p className="p-8 text-center text-[11px] text-[#928a7f]">{error ? "Connect Supabase to manage products." : "No saved products yet. Add your first product."}</p>}</div></PanelCard>
    {editing && <div role="presentation" className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(false); }}><form onSubmit={save} className="h-full w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">Add storefront product</h2><p className="mt-1 text-[11px] text-[#928a7e]">Product details, size pricing, finishes, dimensions, materials, and product media.</p></div><button type="button" onClick={() => setEditing(false)}><X size={18} /></button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{field("name", "Product name", "Cortez Outdoor Table")}{field("slug", "URL slug (optional)", "cortez-outdoor-table")}{field("sku", "SKU", "CL-0001")}<label className="block text-[10px] font-medium text-[#716a60]">Department<select value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border px-3 text-[11px]">{[["lamps","Lamps"],["mirrors","Mirrors"],["tables","Tables"],["shades","Shades"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="block text-[10px] font-medium text-[#716a60]">Subcategory<input value={form.subcategory_name} onChange={(e) => setForm({ ...form, subcategory_name: e.target.value })} placeholder="e.g. Table Lamps" className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]" /></label>{field("price_bdt", "Selling price (BDT)", "35300", "number")}{field("cost_price_bdt", "Unit cost (BDT)", "21000", "number")}{field("compare_at_price_bdt", "Original price (optional)", "47300", "number")}{field("inventory_quantity", "Stock quantity", "0", "number")}{field("lead_time", "Made to order lead time", "4–6 weeks")}<label className="block text-[10px] font-medium text-[#716a60]">Collection filter<select value={form.promotion} onChange={(event) => setForm({ ...form, promotion: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px]"><option value="">None</option><option value="new">New Arrivals</option><option value="sale">Hot Deals</option></select><span className="mt-1 block text-[9px] font-normal text-[#928a7e]">Controls the New Arrivals / Hot Deals filters on collection pages.</span></label></div>
      <label className="mt-4 block text-[10px] font-medium text-[#716a60]">Short description<input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border px-3 text-[11px]" /></label><label className="mt-4 block text-[10px] font-medium text-[#716a60]">Full description<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5 w-full rounded-lg border p-3 text-[11px]" /></label>
      <h3 className="mt-5 text-[12px] font-semibold text-[#222]">Default dimensions</h3><p className="mt-1 text-[10px] text-[#777]">Used as a fallback for sizes that do not have their own dimensions.</p><div className="mt-3 grid gap-4 sm:grid-cols-2">{field("width", "Width", "55 cm")}{field("depth", "Depth", "45 cm")}{field("height", "Height", "52 cm")}{field("top", "Top / surface", "Solid surface")}{field("weight", "Weight", "8 kg")}</div>
      {parseOptions(form.sizes).map(({ label }) => <section key={label} className="mt-4 rounded-xl border border-[#eee8df] bg-[#fcfbf9] p-4"><h4 className="text-[11px] font-semibold text-[#48443d]">{label} dimensions</h4><p className="mt-1 text-[9px] text-[#928a7e]">These values appear when customers select {label}.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{([ ["width", "Width", "55 cm"], ["depth", "Depth", "45 cm"], ["height", "Height", "52 cm"], ["top", "Top / surface", "Solid surface"], ["weight", "Weight", "8 kg"] ] as const).map(([key, title, placeholder]) => <label key={key} className="block text-[10px] font-medium text-[#716a60]">{title}<input value={sizeDimensions[label]?.[key] ?? ""} onChange={(event) => setSizeDimensions((current) => ({ ...current, [label]: { ...current[label], [key]: event.target.value } }))} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]" /></label>)}</div></section>)}
      <h3 className="mt-5 text-[12px] font-semibold text-[#222]">Materials and care details</h3><p className="mt-1 text-[10px] text-[#777]">Materials also powers the storefront material filter. Add colour options in the palette below.</p><div className="mt-3 grid gap-4 sm:grid-cols-2">{field("materials", "Materials (comma separated)", "Solid wood, marble, or metal")}{field("finish", "Finish", "Hand-finished surface")}{field("assembly", "Assembly", "Simple home assembly")}{field("care", "Care", "Wipe with a soft dry cloth")}{field("warranty", "Warranty", "1-year quality cover")}{field("sizes", "Sizes and price adjustment (Label:BDT delta, comma separated)", "Small:0, Medium:6400, Large:12000")}</div>
            <section className="mt-5 rounded-xl border border-[#eee8df] bg-white p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-[12px] font-semibold text-[#48443d]">Colour finishes</h3><p className="mt-1 text-[10px] text-[#928a7e]">Choose a finish name, swatch colour, and the product photo customers should see for that finish.</p></div><button type="button" onClick={() => setSwatches((current) => [...current, { label: "", color: "#c8a96e", imageUrl: "" }])} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#e8dfd2] bg-white px-3 py-2 text-[10px] font-medium text-[#805d35]"><Plus size={13} /> Add finish</button></div><div className="space-y-3">{swatches.map((swatch, index) => <div key={index} className="grid gap-2 rounded-lg border border-[#eee8df] bg-white p-3 sm:grid-cols-[1fr_82px_1.4fr_auto] sm:items-end"><label className="block text-[9px] font-medium text-[#716a60]">Finish name<input value={swatch.label} onChange={(event) => setSwatches((current) => current.map((item, row) => row === index ? { ...item, label: event.target.value } : item))} placeholder="Natural Oak" className="mt-1 h-9 w-full rounded-md border border-[#e9e4dc] px-2 text-[11px] outline-none focus:border-[#c9a06a]" /></label><label className="block text-[9px] font-medium text-[#716a60]">Swatch<input type="color" value={swatch.color} onChange={(event) => setSwatches((current) => current.map((item, row) => row === index ? { ...item, color: event.target.value } : item))} className="mt-1 h-9 w-full rounded-md border border-[#e9e4dc] bg-white p-1" /></label><div><label className="inline-flex cursor-pointer items-center gap-1 text-[9px] text-[#8d6437]"><FileImage size={12} /> Upload finish image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { void uploadSwatchImage(index, event.target.files?.[0]); event.target.value = ""; }} className="sr-only" /></label></div><div className="flex items-center gap-2">{swatch.imageUrl && <><img src={swatch.imageUrl} alt={`${swatch.label || "Finish"} preview`} className="h-9 w-9 rounded-md object-cover" /><button type="button" onClick={() => setSwatches((current) => current.map((item, row) => row === index ? { ...item, imageUrl: "" } : item))} className="text-[9px] text-[#8d6437]">Remove image</button></>}<button type="button" aria-label="Remove colour finish" disabled={swatches.length === 1} onClick={() => setSwatches((current) => current.filter((_, row) => row !== index))} className="rounded-md px-2 py-2 text-[#948c80] hover:bg-white disabled:opacity-30"><X size={14} /></button></div></div>)}</div></section>
      <section className="mt-4"><label className="block text-[10px] font-medium text-[#716a60]">Upload product images<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(e) => void uploadImages(e)} className="mt-1.5 block w-full text-[11px]" />{uploading && <span className="mt-1 block text-[#8d6437]">Uploading…</span>}</label>{form.images && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{form.images.split(/\n|,/).filter(Boolean).map((url, index) => <div key={`${url}-${index}`} className="relative"><img src={url.trim()} alt={`${form.name || "Product"} photo ${index + 1}`} className="h-20 w-full rounded-md border border-[#e9e4dc] object-cover" /><button type="button" aria-label={`Remove product image ${index + 1}`} onClick={() => setForm((current) => ({ ...current, images: current.images.split(/\n|,/).map((item) => item.trim()).filter(Boolean).filter((_, itemIndex) => itemIndex !== index).join("\n") }))} className="absolute right-1 top-1 rounded-full bg-white px-2 py-1 text-[9px] shadow">Remove</button></div>)}</div>}<p className="mt-2 text-[9px] text-[#928a7e]">Upload JPG, PNG, WebP, or AVIF images. The first image is the main product photo.</p></section><div className="mt-4 flex flex-wrap gap-5 text-[11px]"><label><input type="checkbox" checked={form.made_to_order} onChange={(e) => setForm({ ...form, made_to_order: e.target.checked })} /> Made to order</label><label><input type="checkbox" checked={form.special_edition} onChange={(e) => setForm({ ...form, special_edition: e.target.checked })} /> Special edition</label><label><input type="checkbox" checked={form.status === "active"} onChange={(e) => setForm({ ...form, status: e.target.checked ? "active" : "draft" })} /> Publish immediately</label></div><div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-white py-4"><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={saving || uploading}>{saving ? "Saving…" : "Save product"}</Button></div></form></div>}
  </>;
}

type AdminCategory = { id: string; name: string; slug: string; parent_id: string | null; is_fixed: boolean; is_active: boolean; sort_order: number };

function CategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [activeId, setActiveId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    apiFetch("/api/admin/categories", { cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load categories."); return result.categories as AdminCategory[]; })
      .then((rows) => { setCategories(rows); setActiveId((current) => current || rows.find((category) => !category.parent_id)?.id || ""); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load categories."))
      .finally(() => setLoading(false));
  }, []);
  const parents = categories.filter((category) => !category.parent_id);
  const selected = parents.find((category) => category.id === activeId) ?? parents[0];
  const children = categories.filter((category) => category.parent_id === selected?.id);
  const saveRename = async () => {
    if (!editingId || !editingName.trim()) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/admin/categories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, name: editingName.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not rename this subcategory.");
      setCategories((rows) => rows.map((category) => category.id === editingId ? result.category : category));
      notifyStorefrontDataUpdated();
      setNotice("Subcategory renamed. The storefront will use the new name.");
      setEditingId(""); setEditingName("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not rename this subcategory."); }
    finally { setSaving(false); }
  };
  const removeCategory = async (category: AdminCategory) => {
    if (!window.confirm(`Remove “${category.name}”? Products assigned to it must be reassigned first.`)) return;
    setDeletingId(category.id); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/admin/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: category.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not remove this subcategory.");
      setCategories((rows) => rows.filter((item) => item.id !== category.id));
      notifyStorefrontDataUpdated();
      setNotice("Subcategory removed from navigation and the storefront.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove this subcategory."); }
    finally { setDeletingId(""); }
  };
  return <>
    <SectionHeading title="Categories" description="Rename or remove subcategories shown across product listings and navigation. Main departments are protected." />
    {error && <div role="alert" className="mb-3 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#9d5548]">{error}{/sign in|administrator account/i.test(error) && <a href="/login" className="ml-2 inline-flex font-semibold underline">Sign in as administrator</a>}</div>}
    {notice && <p role="status" className="mb-3 rounded-lg border border-[#dce8d8] bg-[#f2f7ef] p-3 text-[11px] text-[#587052]">{notice}</p>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{parents.map((category) => <button key={category.id} onClick={() => setActiveId(category.id)} className={`rounded-xl border p-4 text-left transition ${activeId === category.id ? "border-[#171717] bg-white" : "border-[#e5e5e5] bg-white hover:border-[#bdbdbd]"}`}><span className="flex items-center justify-between"><span className="text-[12px] font-semibold text-[#222]">{category.name}</span><LockKeyhole size={13} className="text-[#737373]" /></span><span className="mt-2 block text-[10px] text-[#737373]">{categories.filter((item) => item.parent_id === category.id).length} subcategories · Fixed</span></button>)}</div>
    <PanelCard><div className="flex items-center justify-between border-b border-[#e5e5e5] px-5 py-4"><div><h2 className="text-[13px] font-semibold text-[#222]">Subcategories in {selected?.name ?? "department"}</h2><p className="mt-1 text-[10px] text-[#737373]">Renaming keeps the saved category link stable.</p></div><span className="rounded-md bg-[#f3f3f3] px-2.5 py-1.5 text-[10px] text-[#555]">Department name fixed</span></div>
      {loading ? <p className="p-6 text-center text-[11px] text-[#737373]">Loading categories…</p> : children.length ? <div className="divide-y divide-[#ededed]">{children.map((category) => <div key={category.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f3f3] text-[#555]"><Tag size={15} /></div>{editingId === category.id ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><input autoFocus maxLength={80} value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveRename(); } if (event.key === "Escape") setEditingId(""); }} className="h-10 min-w-[180px] flex-1 rounded-lg border border-[#d5d5d5] px-3 text-[12px] text-[#222] outline-none focus:border-black" /><Button disabled={saving || !editingName.trim()} onClick={() => void saveRename()}>{saving ? "Saving…" : "Save name"}</Button><Button variant="secondary" disabled={saving} onClick={() => setEditingId("")}>Cancel</Button></div> : <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-[#222]">{category.name}</p><p className="mt-1 text-[9px] text-[#737373]">/{selected?.slug}/{category.slug}</p></div>}{editingId !== category.id && <><StatusPill>{category.is_active ? "Active" : "Archived"}</StatusPill><Button variant="secondary" className="min-h-8 px-3 text-[10px]" onClick={() => { setEditingId(category.id); setEditingName(category.name); setError(""); }}>Rename</Button><Button variant="quiet" className="min-h-8 px-3 text-[10px] text-[#9d5548]" disabled={saving || deletingId === category.id} onClick={() => void removeCategory(category)}><Trash2 size={12} />{deletingId === category.id ? "Removing..." : "Remove"}</Button></>}</div>)}</div> : <p className="p-6 text-center text-[11px] text-[#737373]">{error ? "Categories could not be loaded." : "No subcategories in this department."}</p>}
    </PanelCard>
    <p className="mt-3 flex items-center gap-2 text-[10px] text-[#737373]"><LockKeyhole size={12} /> Main departments cannot be renamed or removed. Reassign products before removing a subcategory.</p>
  </>;
}
type AdminCustomer = { id: string; name: string; email: string; phone: string; orders: number; spent: number; joined: string; status: string };

function CustomersPage() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch("/api/admin/customers", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Customers could not be loaded.");
        return result.customers as AdminCustomer[];
      })
      .then((data) => { if (active) setCustomers(data ?? []); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Customers could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const list = customers.filter((customer) => [customer.name, customer.email, customer.phone].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <>
    <SectionHeading title="Customers" description="Registered customers and their confirmed store history." />
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{error}</p>}
    <PanelCard>
      <div className="border-b border-[#f0ece6] p-4"><div className="max-w-[320px]"><SearchField value={query} onChange={setQuery} placeholder="Search customers..." /></div></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left">
          <thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Customer", "Orders", "Total spent", "Joined", "Segment"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{list.map((customer) => <tr key={customer.id} className="border-t border-[#f3f0ea] text-[11px]">
            <td className="px-5 py-4"><p className="font-semibold text-[#48443d]">{customer.name}</p><p className="mt-1 text-[9px] text-[#9c958a]">{customer.email}{customer.phone ? " | " + customer.phone : ""}</p></td>
            <td className="px-5 py-4 text-[#625d55]">{customer.orders}</td>
            <td className="px-5 py-4 font-semibold text-[#48443d]">{money(customer.spent)}</td>
            <td className="px-5 py-4 text-[#756f65]">{customer.joined ? new Date(customer.joined).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "2-digit" }) : "N/A"}</td>
            <td className="px-5 py-4"><StatusPill>{customer.status}</StatusPill></td>
          </tr>)}</tbody>
        </table>
        {loading && <p role="status" className="p-10 text-center text-xs text-[#928a7f]">Loading customers...</p>}
        {!loading && !list.length && <p className="p-10 text-center text-xs text-[#928a7f]">{error ? "Customer records are unavailable." : "No matching customer accounts."}</p>}
      </div>
    </PanelCard>
  </>;
}

function ReviewsPage() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/reviews?admin=1", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load reviews.");
        return result as { reviews: AdminReview[] };
      })
      .then((result) => { if (active) { setItems(result.reviews); setError(""); } })
      .catch((fetchError: unknown) => { if (active) setError(fetchError instanceof Error ? fetchError.message : "Could not load reviews."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const moderate = async (review: AdminReview, status: AdminReview["status"]) => {
    setBusyId(review.id);
    setNotice("");
    try {
      const response = await apiFetch("/api/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this review.");
      setItems((current) => current.map((item) => item.id === review.id ? { ...item, status } : item));
      setNotice(status === "published" ? "Review approved and visible on the product page." : status === "hidden" ? "Review hidden from the storefront." : "Review returned to pending.");
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : "Could not update this review.");
    } finally {
      setBusyId("");
    }
  };

  const filtered = filter === "all" ? items : items.filter((item) => item.status === filter);
  const published = items.filter((item) => item.status === "published");
  const average = published.length ? published.reduce((sum, item) => sum + item.rating, 0) / published.length : 0;
  const stats = [
    { label: "Average published rating", value: published.length ? `${average.toFixed(1)} / 5` : "—" },
    { label: "Published reviews", value: String(published.length) },
    { label: "Awaiting approval", value: String(items.filter((item) => item.status === "pending").length) },
  ];

  return <>
    <SectionHeading title="Reviews" description="Approve customer reviews before they appear on product pages." />
    <div className="mb-4 grid gap-3 sm:grid-cols-3">{stats.map((item) => <PanelCard key={item.label} className="p-4"><p className="text-[10px] text-[#8f887e]">{item.label}</p><p className="mt-2 text-[20px] font-semibold text-[#34312c]">{item.value}</p></PanelCard>)}</div>
    <PanelCard>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#f0ece6] p-4"><label className="text-[10px] font-medium text-[#716a60]">Show <select value={filter} onChange={(event) => setFilter(event.target.value)} className="ml-2 h-9 rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139]"><option value="all">All reviews</option><option value="pending">Awaiting approval</option><option value="published">Published</option><option value="hidden">Hidden</option></select></label><span className="ml-auto text-[10px] text-[#9a9388]">{items.length} total reviews</span></div>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`mx-4 mt-4 rounded-lg px-3 py-2.5 text-[11px] ${error ? "bg-[#fbefec] text-[#9d5548]" : "bg-[#f1f6ee] text-[#587052]"}`}>{error || notice}</p>}
      {loading ? <div className="p-10 text-center text-xs text-[#928a7f]">Loading customer reviews…</div> : filtered.length === 0 ? <div className="p-10 text-center"><p className="text-[13px] font-medium text-[#48443d]">{error ? "Reviews are not connected" : "No reviews here yet"}</p><p className="mt-1 text-[11px] text-[#928a7f]">{error || "Customer submissions will appear here for approval."}</p></div> : <div className="divide-y divide-[#f3f0ea]">{filtered.map((review) => {
        const productName = PRODUCTS.find((product) => product.id === review.product_slug)?.name ?? review.product_slug ?? "Product";
        return <article key={review.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#91683b]">{review.customer_name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-[12px] font-semibold text-[#454139]">{review.customer_name}</p><span className="text-[10px] text-[#aaa297]">· {new Date(review.created_at).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })} · {productName}</span></div><p className="mt-2 text-[11px] font-medium tracking-[.06em] text-[#b88a45]">{"★".repeat(review.rating)}<span className="text-[#e8e2d8]">{"★".repeat(5 - review.rating)}</span><span className="ml-2 tracking-normal text-[#827b70]">{review.rating}/5</span></p>{review.title && <h3 className="mt-2 text-[12px] font-semibold text-[#454139]">{review.title}</h3>}<p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-5 text-[#6f695f]">{review.body}</p></div><StatusPill>{review.status === "published" ? "Published" : review.status === "pending" ? "Pending" : "Hidden"}</StatusPill></div><div className="mt-4 flex flex-wrap justify-end gap-2">{review.status !== "published" && <Button disabled={busyId === review.id} onClick={() => void moderate(review, "published")}><Check size={14} /> Approve &amp; publish</Button>}{review.status !== "hidden" && <Button variant="secondary" disabled={busyId === review.id} onClick={() => void moderate(review, "hidden")}><X size={14} /> Hide</Button>}{review.status !== "pending" && <Button variant="quiet" disabled={busyId === review.id} onClick={() => void moderate(review, "pending")}>Return to pending</Button>}</div></article>;
      })}</div>}
    </PanelCard>
  </>;
}

function CustomRequestsPage() {
  const [requests, setRequests] = useState(demoRequests);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All requests");
  const [selected, setSelected] = useState<CustomRequestRecord | null>(null);
  const [source, setSource] = useState<"preview" | "live">("preview");
  const [notice, setNotice] = useState("Loading submitted requests…");
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");
  const [savingStatusId, setSavingStatusId] = useState("");

  useEffect(() => {
    let active = true;
    setNotice("Loading submitted requests…");
    apiFetch("/api/custom-requests", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load requests.");
        return result as { requests: CustomRequestRecord[] };
      })
      .then((result) => {
        if (!active) return;
        setRequests(result.requests);
        setSource("live");
        setNotice("");
      })
      .catch(() => {
        if (active) setNotice("Showing sample requests. Configure Supabase and sign in as an admin to see customer submissions.");
      });
    return () => { active = false; };
  }, [refreshKey]);

  const filtered = requests.filter((request) => {
    const matchesText = `${request.request_number} ${request.full_name} ${request.email ?? ""} ${request.phone}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (filter === "All requests" || request.status.toLowerCase() === filter.toLowerCase());
  });
  const displayStatus = (status: string) => status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const displayDate = (date: string) => new Date(date).toLocaleString("en-BD", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const changeRequestStatus = async (request: CustomRequestRecord, status: string) => {
    if (source !== "live" || status === request.status) return;
    const quoteValue = status === "quoted" ? window.prompt("Enter the customer quote amount in BDT:", request.quoted_price_bdt == null ? "" : String(request.quoted_price_bdt)) : null;
    if (status === "quoted" && (quoteValue == null || !quoteValue.trim() || !Number.isFinite(Number(quoteValue)) || Number(quoteValue) < 0)) return;
    setSavingStatusId(request.id);
    setStatusError("");
    setStatusSuccess("");
    try {
      const response = await apiFetch("/api/custom-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: request.id, status, ...(status === "quoted" ? { quoted_price_bdt: Number(quoteValue) } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Request status could not be updated.");
      const event: StatusEvent = { id: crypto.randomUUID(), from_status: request.status, to_status: status, actor_email: "You", note: null, created_at: new Date().toISOString() };
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, quoted_price_bdt: status === "quoted" ? Number(quoteValue) : item.quoted_price_bdt, custom_request_status_events: [event, ...(item.custom_request_status_events ?? [])] } : item));
      setSelected((current) => current?.id === request.id ? { ...current, status, quoted_price_bdt: status === "quoted" ? Number(quoteValue) : current.quoted_price_bdt, custom_request_status_events: [event, ...(current.custom_request_status_events ?? [])] } : current);
      setStatusSuccess(status === "quoted" ? `Quote saved for request CR-${request.request_number}.` : `Request status updated to ${displayStatus(status)}.`);
    } catch (reason) {
      setStatusError(reason instanceof Error ? reason.message : "Request status could not be updated.");
    } finally {
      setSavingStatusId("");
    }
  };
  const requestStatusOptions = (request: CustomRequestRecord) => {
    const next: Record<string, string[]> = { new: ["reviewing", "declined", "cancelled"], pending: ["reviewing", "confirmed", "declined", "cancelled"], reviewing: ["quoted", "declined", "cancelled"], quoted: ["confirmed", "declined", "cancelled"], confirmed: ["processing", "cancelled"], processing: ["shipped", "completed", "cancelled"], shipped: ["delivered"], delivered: ["completed"] };
    return [...new Set([request.status, ...(next[request.status] ?? [])])];
  };

  return <>
    <SectionHeading title="Custom requests" description="Customer ideas, reference photos, and contact details in one inbox." action={<Button variant="secondary" onClick={() => setRefreshKey((key) => key + 1)}><Activity size={14} /> Refresh inbox</Button>} />
    {notice && <div className={`mb-4 rounded-lg border px-4 py-3 text-[11px] ${source === "preview" && notice.startsWith("Showing") ? "border-[#e9dfcd] bg-white text-[#806b4a]" : "border-[#ece6dd] bg-white text-[#8b8479]"}`}>{notice}</div>}
    <div className="mb-4 grid gap-3 sm:grid-cols-3">{[{ label: "Total requests", value: source === "live" ? String(requests.length) : "3" }, { label: "New to review", value: String(requests.filter((request) => request.status === "new").length) }, { label: "With reference photos", value: String(requests.filter((request) => request.images.length > 0).length) }].map((item) => <PanelCard key={item.label} className="p-4"><p className="text-[10px] text-[#8f887e]">{item.label}</p><p className="mt-2 text-[20px] font-semibold text-[#34312c]">{item.value}</p></PanelCard>)}</div>
    <PanelCard><div className="flex flex-wrap items-center gap-2 border-b border-[#f0ece6] p-4"><div className="w-full sm:max-w-[320px]"><SearchField value={query} onChange={setQuery} placeholder="Search name, email, or request…" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#5a554d] outline-none sm:w-auto"><option>All requests</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="quoted">Quoted</option><option value="completed">Completed</option><option value="declined">Declined</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option><option value="refunded">Refunded</option></select><span className="ml-auto text-[10px] text-[#9a9388]">{filtered.length} requests</span></div><div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-left"><thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Request", "Customer", "Submitted", "References", "Status", ""].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{filtered.map((request) => <tr key={request.id} className="border-t border-[#f3f0ea] text-[11px] hover:bg-white"><td className="px-4 py-4 font-semibold text-[#48443d]">CR-{String(request.request_number).replace(/^CR-/, "")}<p className="mt-1 max-w-[210px] truncate text-[9px] font-normal text-[#9c958a]">{request.description}</p></td><td className="px-4 py-4"><p className="font-medium text-[#48443d]">{request.full_name}</p><p className="mt-1 text-[9px] text-[#9c958a]">{request.phone}</p></td><td className="px-4 py-4 text-[#756f65]">{displayDate(request.created_at)}</td><td className="px-4 py-4 text-[#756f65]">{request.images.length ? `${request.images.length} photo${request.images.length > 1 ? "s" : ""}` : "None"}</td><td className="px-4 py-4"><select aria-label={"Status for request " + request.request_number} value={request.status} disabled={source !== "live" || savingStatusId === request.id} onChange={(event) => void changeRequestStatus(request, event.target.value)} className="h-9 max-w-full rounded-md border border-[#e9e4dc] bg-white px-2 text-[10px] text-[#48443d] disabled:opacity-60">{requestStatusOptions(request).map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></td><td className="px-4 py-4"><button onClick={() => setSelected(request)} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#8d6437] hover:bg-white"><Eye size={13} /> View</button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="p-10 text-center text-xs text-[#928a7f]">No requests match your search.</div>}</div></PanelCard>
    {statusError && <p role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{statusError}</p>}{statusSuccess && <p role="status" className="mb-4 rounded-lg border border-[#dce8d8] bg-[#f2f7ef] p-3 text-[11px] text-[#587052]">{statusSuccess}</p>}<div className="space-y-3 p-3 sm:hidden">{filtered.map((request) => <article key={request.id} className="min-w-0 rounded-lg border border-[#eee8df] p-3"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-semibold text-[#48443d]">CR-{String(request.request_number).replace(/^CR-/, "")}</p><p className="mt-1 break-words text-[12px] font-medium text-[#34312c]">{request.full_name}</p><p className="mt-1 break-all text-[10px] text-[#8c857b]">{request.phone}{request.email ? " · " + request.email : ""}</p></div><span className="shrink-0 text-[9px] text-[#8c857b]">{request.images.length} photo{request.images.length === 1 ? "" : "s"}</span></div><p className="mt-2 text-[10px] text-[#8c857b]">{displayDate(request.created_at)}</p><label className="mt-3 block text-[10px] font-medium text-[#716a60]">Request status<select aria-label={"Status for request " + request.request_number} value={request.status} disabled={source !== "live" || savingStatusId === request.id} onChange={(event) => void changeRequestStatus(request, event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[12px] text-[#48443d] disabled:opacity-60">{requestStatusOptions(request).map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label><button onClick={() => setSelected(request)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#e9e4dc] px-3 text-[11px] font-semibold text-[#8d6437]"><Eye size={14} /> View request</button></article>)}{filtered.length === 0 && <div className="p-8 text-center text-xs text-[#928a7f]">No requests match your search.</div>}</div>{selected && <div role="presentation" className="fixed inset-0 z-50 flex justify-end bg-[#28241f]/35 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside role="dialog" aria-modal="true" aria-label={`Request from ${selected.full_name}`} className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#ece6dd] bg-white/95 px-4 py-3 backdrop-blur sm:px-7 sm:py-4"><div><p className="text-[9px] font-medium uppercase tracking-[.15em] text-[#a77b47]">Custom request</p><h2 className="mt-1 text-[18px] font-semibold text-[#302d27]">CR-{String(selected.request_number).replace(/^CR-/, "")}</h2></div><div className="flex items-center gap-2"><select aria-label="Custom request status" value={selected.status} disabled={source !== "live" || savingStatusId === selected.id} onChange={(event) => void changeRequestStatus(selected, event.target.value)} className="h-10 max-w-[185px] rounded-lg border border-[#e9e4dc] bg-white px-2 text-[11px] text-[#48443d] disabled:opacity-60">{requestStatusOptions(selected).map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select><button aria-label="Close request" onClick={() => setSelected(null)} className="rounded-md p-2 text-[#827b70] hover:bg-white"><X size={16} /></button></div></div><div className="space-y-4 p-3 sm:space-y-5 sm:p-7"><PanelCard className="p-4 sm:p-5"><h3 className="text-[12px] font-semibold text-[#34312c]">Customer information</h3><div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">{[{ label: "Full name", value: selected.full_name }, { label: "Phone number", value: selected.phone }, { label: "Email address", value: selected.email || "Not provided" }, { label: "City / area", value: selected.city_area }].map((field) => <div key={field.label}><p className="text-[9px] uppercase tracking-[.1em] text-[#a09a90]">{field.label}</p><p className="mt-1 break-words text-[11px] font-medium text-[#48443d]">{field.value}</p></div>)}<div className="sm:col-span-2"><p className="text-[9px] uppercase tracking-[.1em] text-[#a09a90]">Delivery address</p><p className="mt-1 text-[11px] font-medium text-[#48443d]">{selected.delivery_address}</p></div></div></PanelCard>{selected.quoted_price_bdt != null && <PanelCard className="p-4"><p className="text-[10px] uppercase tracking-[.1em] text-[#a09a90]">Current quote</p><p className="mt-1 text-[16px] font-semibold text-[#34312c]">{money(Number(selected.quoted_price_bdt))}</p></PanelCard>}{selected.custom_request_status_events?.length ? <PanelCard className="p-4"><h3 className="text-[12px] font-semibold text-[#34312c]">Status history</h3><ol className="mt-3 space-y-2">{[...selected.custom_request_status_events].sort((a,b) => a.created_at.localeCompare(b.created_at)).map((event) => <li key={event.id} className="border-l border-[#DBD5C7] pl-3 text-[10px]"><p className="font-medium capitalize text-[#48443d]">{event.to_status} <span className="font-normal text-[#928a7e]">· {new Date(event.created_at).toLocaleString("en-BD")} by {event.actor_email}</span></p>{event.note && <p className="mt-1 text-[#777168]">{event.note}</p>}</li>)}</ol></PanelCard> : null}<PanelCard className="p-5"><div className="flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#34312c]">Request description</h3><span className="text-[9px] text-[#a09a90]">Submitted {displayDate(selected.created_at)}</span></div><p className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-[#625d55]">{selected.description}</p></PanelCard><PanelCard className="p-5"><div className="flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#34312c]">Reference photos</h3><span className="text-[9px] text-[#a09a90]">{selected.images.length} attached</span></div>{selected.images.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{selected.images.map((image) => <a key={image.id} href={image.signed_url || "#"} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-[#ece6dd] bg-white"><div className="aspect-square overflow-hidden"><img src={image.signed_url || ""} alt={image.file_name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /></div><p className="truncate px-2.5 py-2 text-[9px] text-[#777168]">{image.file_name}</p></a>)}</div> : <p className="mt-3 text-[11px] text-[#928a7f]">No reference photos were attached.</p>}</PanelCard></div></aside></div>}
  </>;
}

type AdminCoupon = { id: string; code: string; description: string | null; discount_type: "percentage" | "fixed"; discount_value: number; minimum_order_bdt: number; usage_limit: number | null; usage_count: number; is_active: boolean; starts_at: string | null; ends_at: string | null };

function CouponsPage() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "", discount_type: "percentage" as "percentage" | "fixed", discount_value: "", minimum_order_bdt: "0", usage_limit: "" });
  const loadCoupons = () => apiFetch("/api/admin/coupons", { cache: "no-store" }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Coupons could not be loaded.");
    setCoupons(result.coupons ?? []);
  });
  useEffect(() => {
    let active = true;
    loadCoupons().catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Coupons could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const createCoupon = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, discount_value: Number(form.discount_value), minimum_order_bdt: Number(form.minimum_order_bdt), usage_limit: form.usage_limit ? Number(form.usage_limit) : null }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Coupon could not be saved.");
      setCoupons((current) => [result.coupon, ...current]);
      setForm({ code: "", discount_type: "percentage", discount_value: "", minimum_order_bdt: "0", usage_limit: "" });
      setShowForm(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Coupon could not be saved."); }
    finally { setSaving(false); }
  };
  const changeCoupon = async (coupon: AdminCoupon) => {
    setError("");
    try {
      const response = await apiFetch("/api/admin/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: coupon.id, is_active: !coupon.is_active }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Coupon status could not be updated.");
      setCoupons((current) => current.map((item) => item.id === coupon.id ? { ...item, is_active: !coupon.is_active } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Coupon status could not be updated."); }
  };
  const deleteCoupon = async (coupon: AdminCoupon) => {
    if (!window.confirm("Delete coupon " + coupon.code + "?")) return;
    setError("");
    try {
      const response = await apiFetch("/api/admin/coupons", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: coupon.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Coupon could not be deleted.");
      setCoupons((current) => current.filter((item) => item.id !== coupon.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Coupon could not be deleted."); }
  };
  const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]";
  return <>
    <SectionHeading title="Coupons" description="Coupon codes are saved in Supabase. Checkout redemption is not enabled yet." action={<Button onClick={() => setShowForm((value) => !value)}><Plus size={15} /> {showForm ? "Close form" : "Create coupon"}</Button>} />
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{error}</p>}
    {showForm && <PanelCard className="mb-4 p-5"><form onSubmit={createCoupon} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-[10px] font-medium text-[#716a60]">Code<input required minLength={2} maxLength={32} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className={fieldClass} /></label>
      <label className="text-[10px] font-medium text-[#716a60]">Discount type<select value={form.discount_type} onChange={(event) => setForm({ ...form, discount_type: event.target.value as "percentage" | "fixed" })} className={fieldClass}><option value="percentage">Percentage</option><option value="fixed">Fixed BDT</option></select></label>
      <label className="text-[10px] font-medium text-[#716a60]">Discount value<input required type="number" min="0.01" max={form.discount_type === "percentage" ? 100 : undefined} step="0.01" value={form.discount_value} onChange={(event) => setForm({ ...form, discount_value: event.target.value })} className={fieldClass} /></label>
      <label className="text-[10px] font-medium text-[#716a60]">Minimum order (BDT)<input type="number" min="0" step="0.01" value={form.minimum_order_bdt} onChange={(event) => setForm({ ...form, minimum_order_bdt: event.target.value })} className={fieldClass} /></label>
      <label className="text-[10px] font-medium text-[#716a60]">Use limit (optional)<input type="number" min="1" step="1" value={form.usage_limit} onChange={(event) => setForm({ ...form, usage_limit: event.target.value })} className={fieldClass} /></label>
      <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-5"><Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving?" : "Save coupon"}</Button></div>
    </form></PanelCard>}
    <PanelCard className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left">
      <thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Code", "Offer", "Uses", "Minimum order", "Status", ""].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
      <tbody>{coupons.map((coupon) => <tr key={coupon.id} className="border-t border-[#f3f0ea] text-[11px]">
        <td className="px-4 py-4 font-mono font-semibold tracking-wide text-[#8d6437]">{coupon.code}</td>
        <td className="px-4 py-4 text-[#48443d]">{coupon.discount_type === "percentage" ? coupon.discount_value + "% off" : money(Math.round(Number(coupon.discount_value) * 100)) + " off"}{coupon.description ? <span className="mt-1 block text-[9px] text-[#9c958a]">{coupon.description}</span> : null}</td>
        <td className="px-4 py-4 text-[#756f65]">{coupon.usage_count}{coupon.usage_limit == null ? " / ?" : " / " + coupon.usage_limit}</td>
        <td className="px-4 py-4 text-[#756f65]">{money(Math.round(Number(coupon.minimum_order_bdt) * 100))}</td>
        <td className="px-4 py-4"><button type="button" onClick={() => changeCoupon(coupon)}><StatusPill>{coupon.is_active ? "Active" : "Inactive"}</StatusPill></button></td>
        <td className="px-4 py-4"><button type="button" aria-label={"Delete coupon " + coupon.code} onClick={() => deleteCoupon(coupon)} className="rounded p-2 text-[#827b70] hover:bg-white"><Trash2 size={14} /></button></td>
      </tr>)}</tbody>
    </table>{loading && <p role="status" className="p-10 text-center text-xs text-[#928a7f]">Loading coupons...</p>}{!loading && !coupons.length && <p className="p-10 text-center text-xs text-[#928a7f]">No coupons have been created yet.</p>}</div></PanelCard>
  </>;
}

type RewardSettings = { enabled: boolean; points_per_100_bdt: number; redemption_points: number; redemption_value_bdt: number };
type RewardTotals = { memberCount: number; pointsBalance: number; pointsDebt: number; spendablePoints: number; pointsIssued: number; pointsRedeemed: number };

function RewardsPage() {
  const [settings, setSettings] = useState<RewardSettings>({ enabled: false, points_per_100_bdt: 1, redemption_points: 100, redemption_value_bdt: 100 });
  const [totals, setTotals] = useState<RewardTotals>({ memberCount: 0, pointsBalance: 0, pointsDebt: 0, spendablePoints: 0, pointsIssued: 0, pointsRedeemed: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadRewards = () => apiFetch("/api/admin/rewards", { cache: "no-store" }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Rewards data could not be loaded.");
    setSettings(result.settings);
    setTotals(result.totals);
  });
  useEffect(() => {
    let active = true;
    loadRewards().catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Rewards data could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/admin/rewards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Reward settings could not be saved.");
      setEditing(false);
      setNotice("Reward programme settings were saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Reward settings could not be saved."); }
    finally { setSaving(false); }
  };
  const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]";
  return <>
    <SectionHeading title="Rewards" description="Live balances and ledger totals from Supabase." action={<Button variant="secondary" onClick={() => setEditing((value) => !value)}><Settings2 size={14} /> {editing ? "Close settings" : "Programme settings"}</Button>} />
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-[#d7e4d2] bg-[#f2f6ef] p-3 text-[11px] text-[#587052]">{notice}</p>}
    <p className="mb-4 rounded-lg border border-[#e8dfd2] bg-white p-3 text-[11px] text-[#716a60]">Eligible orders earn points after delivery. Signed-in customers can redeem available points at checkout; cancellations and refunds reverse coupon use and reward entries.</p>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Members", value: totals.memberCount.toLocaleString() }, { label: "Spendable points", value: totals.spendablePoints.toLocaleString() }, { label: "Points issued", value: totals.pointsIssued.toLocaleString() }, { label: "Points redeemed", value: totals.pointsRedeemed.toLocaleString() }].map((item) => <PanelCard key={item.label} className="p-4"><p className="text-[10px] text-[#8f887e]">{item.label}</p><p className="mt-2 text-[20px] font-semibold text-[#34312c]">{loading ? "?" : item.value}</p></PanelCard>)}</div>
    <PanelCard className="p-6"><div className="flex items-start gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#a77b43]"><Sparkles size={19} /></div><div><h2 className="text-[13px] font-semibold text-[#34312c]">Cloud Rewards</h2><p className="mt-1 max-w-xl text-[11px] leading-5 text-[#80796f]">{totals.spendablePoints.toLocaleString()} points are available to customers after any reversal debt is accounted for. {totals.pointsDebt.toLocaleString()} points are currently owed back from reversed earnings.</p><div className="mt-4 flex flex-wrap gap-5 text-[10px] text-[#8f887e]"><span>Programme <b className="ml-1 text-[#5d7c5e]">{settings.enabled ? "Active" : "Paused"}</b></span><span>Earn rate <b className="ml-1 text-[#524e47]">{settings.points_per_100_bdt} point(s) per BDT 100</b></span><span>Redemption <b className="ml-1 text-[#524e47]">{settings.redemption_points} points = {money(Math.round(settings.redemption_value_bdt * 100))}</b></span></div></div></div>
      {editing && <form onSubmit={save} className="mt-6 grid gap-3 border-t border-[#f0ece6] pt-5 sm:grid-cols-2"><label className="flex items-center gap-2 text-[11px] text-[#716a60]"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} className="accent-[#a77b43]" /> Programme enabled</label><label className="text-[10px] font-medium text-[#716a60]">Points per ?100<input required type="number" min="0" max="1000" step="1" value={settings.points_per_100_bdt} onChange={(event) => setSettings({ ...settings, points_per_100_bdt: Number(event.target.value) })} className={fieldClass} /></label><label className="text-[10px] font-medium text-[#716a60]">Points needed to redeem<input required type="number" min="1" max="1000000" step="1" value={settings.redemption_points} onChange={(event) => setSettings({ ...settings, redemption_points: Number(event.target.value) })} className={fieldClass} /></label><label className="text-[10px] font-medium text-[#716a60]">Redemption value (BDT)<input required type="number" min="0" max="1000000" step="0.01" value={settings.redemption_value_bdt} onChange={(event) => setSettings({ ...settings, redemption_value_bdt: Number(event.target.value) })} className={fieldClass} /></label><div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving?" : "Save programme settings"}</Button></div></form>}
    </PanelCard>
  </>;
}

type MediaAsset = { path: string; name: string; public_url: string; created_at: string | null; metadata: { mimetype?: string; size?: number } | null };

function MediaPage() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [role, setRole] = useState<"hero" | "category" | "deal">("hero");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadMedia = () => apiFetch("/api/admin/media", { cache: "no-store" }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Media could not be loaded.");
    setMedia(result.media ?? []);
  });
  useEffect(() => {
    let active = true;
    loadMedia().catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Media could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setError("Choose a JPG, PNG, WebP, or AVIF image up to 12 MB.");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/admin/media", { method: "POST", headers: { "Content-Type": file.type, "X-Image-Role": role, "X-Image-Alt": file.name }, body: file });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The image could not be uploaded.");
      await loadMedia();
      setNotice("Image uploaded and optimized in Supabase Storage. Add its URL to homepage content to display it.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The image could not be uploaded."); }
    finally { setUploading(false); }
  };
  return <>
    <SectionHeading title="Media library" description="Images stored in the public store-media bucket." action={<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#252723] px-4 py-2.5 text-[11px] font-medium text-white hover:bg-black"><Plus size={15} /> {uploading ? "Uploading..." : "Add media"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={upload} disabled={uploading} className="sr-only" /></label>} />
    <div className="mb-4 flex flex-wrap items-center gap-2"><label className="text-[10px] text-[#716a60]">Upload for <select value={role} onChange={(event) => setRole(event.target.value as "hero" | "category" | "deal")} className="ml-2 h-9 rounded-lg border border-[#e9e4dc] bg-white px-2 text-[10px]"><option value="hero">Homepage hero</option><option value="category">Homepage category</option><option value="deal">Hot deal</option></select></label><p className="text-[10px] text-[#8f887e]">Uploads are optimized and stored. They appear on the site after being selected in Homepage content.</p></div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-[#d7e4d2] bg-[#f2f6ef] p-3 text-[11px] text-[#587052]">{notice}</p>}
    {loading ? <p role="status" className="p-10 text-center text-xs text-[#928a7f]">Loading media...</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{media.map((asset) => <PanelCard key={asset.path} className="group overflow-hidden"><div className="relative aspect-square overflow-hidden bg-white"><img src={asset.public_url} alt={asset.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div><div className="p-3"><p className="truncate text-[10px] font-semibold text-[#4a463f]">{asset.name}</p><p className="mt-1 truncate text-[9px] text-[#9c958a]">{asset.path}</p></div></PanelCard>)}</div>}
    {!loading && !media.length && !error && <PanelCard className="p-10 text-center text-xs text-[#928a7f]">No files in the store media bucket yet.</PanelCard>}
  </>;
}

function HomepageImageField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setError("Use JPG, PNG, WebP, or AVIF files up to 10 MB."); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Set up Supabase to upload images. You can paste an HTTPS image URL for now."); return; }
    setUploading(true); setError("");
    try {
      const path = `homepage/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("store-media").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      onChange(supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image upload failed."); }
    finally { setUploading(false); }
  };
  return <div className="min-w-0"><label className="block text-[10px] font-medium text-[#716a60]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[10px] text-[#454139] outline-none focus:border-[#c9a06a]" /></label><div className="mt-2 flex items-center gap-3"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void upload(event)} className="min-w-0 flex-1 text-[10px]" />{uploading && <span className="text-[10px] text-[#8d6437]">Uploading…</span>}</div>{error && <p role="alert" className="mt-1 text-[10px] text-[#9d5548]">{error}</p>}{value && <img src={value} alt="" className="mt-2 h-24 w-full rounded-lg border border-[#ece6dd] bg-white object-cover" />}</div>;
}

const defaultCollectionOptions = [
  { slug: "all", label: "All products" },
  { slug: "lighting", label: "Lamps" },
  { slug: "mirrors", label: "Mirrors" },
  { slug: "tables", label: "Tables" },
  { slug: "shades", label: "Shades" },
  { slug: "new", label: "New Arrivals" },
  { slug: "sale", label: "Hot Deals" },
];

function HomepageContentPage() {
  const [content, setContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string; category: string; image: string; currentPrice: number; originalPrice: number }[]>([]);
  const [collectionOptions, setCollectionOptions] = useState(defaultCollectionOptions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([apiFetch("/api/homepage-content", { cache: "no-store" }).then((response) => response.json()), apiFetch("/api/catalog", { cache: "no-store" }).then((response) => response.json())])
      .then(([homepage, catalog]) => {
        if (!active) return;
        if (homepage.content?.heroSlides && homepage.content?.categories && homepage.content?.hotDeals) setContent({ ...DEFAULT_HOMEPAGE_CONTENT, ...homepage.content, newArrivals: { ...DEFAULT_HOMEPAGE_CONTENT.newArrivals, ...(Array.isArray(homepage.content.newArrivals) ? { productIds: homepage.content.newArrivals } : homepage.content.newArrivals ?? {}) } });
        if (Array.isArray(catalog.products)) setProductOptions(catalog.products.map((product: any) => ({
          id: product.id,
          name: product.name,
          category: product.subcategory || product.category || "",
          image: product.images?.silo || product.images?.lifestyle || "",
          currentPrice: Number(product.salePrice ?? product.basePrice ?? 0),
          originalPrice: Number(product.salePrice ? product.basePrice : 0),
        })).filter((product: { id: string }) => Boolean(product.id)));
        if (Array.isArray(catalog.categories)) {
          const options = [...defaultCollectionOptions, ...catalog.categories.map((category: any) => ({ slug: category.slug, label: `${category.parentName} · ${category.name}` }))];
          setCollectionOptions(Array.from(new Map(options.map((option) => [option.slug, option])).values()));
        }
      })
      .catch(() => { if (active) setError("Could not load homepage settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateHero = <K extends keyof HeroSlide,>(index: number, key: K, value: HeroSlide[K]) => setContent((current) => ({ ...current, heroSlides: current.heroSlides.map((slide, i) => i === index ? { ...slide, [key]: value } : slide) }));
  const updateCategory = <K extends keyof HomeCategory,>(index: number, key: K, value: HomeCategory[K]) => setContent((current) => ({ ...current, categories: current.categories.map((category, i) => i === index ? { ...category, [key]: value } : category) }));
  const updateDeal = <K extends keyof HotDeal,>(index: number, key: K, value: HotDeal[K]) => setContent((current) => ({ ...current, hotDeals: current.hotDeals.map((deal, i) => i === index ? { ...deal, [key]: value } : deal) }));
  const availableProductIds = new Set(productOptions.map((product) => product.id));
  const unavailableArrivalCount = content.newArrivals.productIds.filter((id) => !availableProductIds.has(id)).length;
  const unavailableDealCount = content.hotDeals.filter((deal) => !availableProductIds.has(deal.productId)).length;
  const removeUnavailableProductLinks = () => setContent((current) => ({
    ...current,
    newArrivals: { ...current.newArrivals, productIds: current.newArrivals.productIds.filter((id) => availableProductIds.has(id)) },
    hotDeals: current.hotDeals.filter((deal) => availableProductIds.has(deal.productId)),
  }));
  const addDeal = () => {
    const product = productOptions[0];
    if (!product || content.hotDeals.length >= 30) return;
    setContent((current) => ({ ...current, hotDealsActive: true, hotDeals: [...current.hotDeals, {
      productId: product.id, name: product.name, category: product.category,
      price: product.currentPrice, was: product.originalPrice || product.currentPrice,
      image: product.image || DEFAULT_HOMEPAGE_CONTENT.hotDeals[0].image,
      alt: product.name, active: false,
    }] }));
  };
  const save = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const normalizedContent = {
        ...content,
        hotDeals: content.hotDeals.map((deal) => {
          const product = productOptions.find((option) => option.id === deal.productId);
          return product ? { ...deal, price: product.currentPrice, was: product.originalPrice || Math.max(deal.was, product.currentPrice) } : deal;
        }),
      };
      const response = await apiFetch("/api/admin/homepage-content", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: normalizedContent }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save homepage content.");
      setContent(normalizedContent);
      notifyStorefrontDataUpdated();
      setNotice("Homepage content saved and published to the storefront.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save homepage content."); }
    finally { setSaving(false); }
  };
  const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]";
  const textAreaClass = "mt-1.5 w-full rounded-lg border border-[#e9e4dc] bg-white p-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]";
  return <>
    <SectionHeading title="Homepage content" description="Manage hero slides, category cards, New Arrivals, and Hot Deals on the storefront." action={<Button disabled={saving || loading} onClick={() => void save()}><Check size={14} /> {saving ? "Saving…" : "Save homepage"}</Button>} />
    <div className="mb-4 rounded-lg border border-[#e8dfd2] bg-white p-3 text-[11px] leading-5 text-[#716a60]">The current web images and copy are preloaded. They stay in place until you upload or enter replacement images and save. Uploaded media is stored in Supabase Storage.</div>
    {error && <p role="alert" className="mb-3 rounded-lg bg-[#fbefec] p-3 text-[11px] text-[#9d5548]">{error}{error.includes("not configured") && <span className="block">Configure Supabase, apply migrations, and sign in with an administrator account.</span>}</p>}
    {notice && <p role="status" className="mb-3 rounded-lg bg-[#f1f6ee] p-3 text-[11px] text-[#587052]">{notice}</p>}
    {!loading && unavailableArrivalCount + unavailableDealCount > 0 && <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e8dfd2] bg-white p-3 text-[11px] text-[#716a60]"><span>{unavailableArrivalCount + unavailableDealCount} homepage link{unavailableArrivalCount + unavailableDealCount === 1 ? "" : "s"} point to unavailable or archived products. Reactivate them in Products or remove the links here.</span><Button variant="secondary" onClick={removeUnavailableProductLinks}>Remove unavailable links</Button></div>}
    {loading ? <PanelCard className="p-8 text-center text-xs text-[#928a7f]">Loading homepage settings…</PanelCard> : <>
      <div className="space-y-4">
        <div><SectionHeading title="Hero slides" description="Manage homepage banners and the collection opened by each button." action={<Button variant="secondary" disabled={content.heroSlides.length >= 10} onClick={() => setContent((current) => ({ ...current, heroSlides: [...current.heroSlides, { ...DEFAULT_HOMEPAGE_CONTENT.heroSlides[0], active: false }] }))}><Plus size={14} /> Add slide</Button>} />{content.heroSlides.map((slide, index) => <PanelCard key={`hero-${index}`} className="mb-3 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#38352f]">Slide {index + 1}</h3><label className="flex items-center gap-2 text-[10px] text-[#716a60]"><input type="checkbox" checked={slide.active} disabled={slide.active && content.heroSlides.filter((item) => item.active).length <= 1} onChange={(event) => updateHero(index, "active", event.target.checked)} /> Show on site</label><Button variant="quiet" className="min-h-8 px-3 text-[10px] text-[#9d5548]" disabled={content.heroSlides.length <= 1} onClick={() => setContent((current) => ({ ...current, heroSlides: current.heroSlides.filter((_, row) => row !== index) }))}><Trash2 size={12} /> Remove slide</Button></div><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><HomepageImageField label="Hero image URL or upload" value={slide.image} onChange={(value) => updateHero(index, "image", value)} /><div className="space-y-3"><label className="block text-[10px] font-medium text-[#716a60]">Eyebrow<input value={slide.eyebrow} onChange={(event) => updateHero(index, "eyebrow", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Headline<textarea rows={2} value={slide.headline} onChange={(event) => updateHero(index, "headline", event.target.value)} className={textAreaClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Supporting text<textarea rows={2} value={slide.subtext} onChange={(event) => updateHero(index, "subtext", event.target.value)} className={textAreaClass} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-medium text-[#716a60]">Button label<input value={slide.ctaLabel} onChange={(event) => updateHero(index, "ctaLabel", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Collection to open<select value={slide.categorySlug} onChange={(event) => updateHero(index, "categorySlug", event.target.value)} className={inputClass}>{!collectionOptions.some((option) => option.slug === slide.categorySlug) && <option value={slide.categorySlug}>Unavailable: {slide.categorySlug}</option>}{collectionOptions.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label></div><label className="block text-[10px] font-medium text-[#716a60]">Image alt text<input value={slide.alt} onChange={(event) => updateHero(index, "alt", event.target.value)} className={inputClass} /></label></div></div></PanelCard>)}</div>
        <div><SectionHeading title="Top category cards" description="These cards link customers to the collections you choose." action={<Button variant="secondary" disabled={content.categories.length >= 12} onClick={() => setContent((current) => ({ ...current, categories: [...current.categories, { ...DEFAULT_HOMEPAGE_CONTENT.categories[0], active: false }] }))}><Plus size={14} /> Add card</Button>} />{content.categories.map((category, index) => <PanelCard key={`category-${index}`} className="mb-3 p-4 sm:p-5"><div className="mb-4 flex justify-end"><Button variant="quiet" className="min-h-8 px-3 text-[10px] text-[#9d5548]" onClick={() => setContent((current) => ({ ...current, categories: current.categories.filter((_, row) => row !== index) }))}><Trash2 size={12} /> Remove card</Button></div><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><HomepageImageField label={`${category.name} image URL or upload`} value={category.image} onChange={(value) => updateCategory(index, "image", value)} /><div className="grid content-start gap-3 sm:grid-cols-2"><label className="block text-[10px] font-medium text-[#716a60]">Card name<input value={category.name} onChange={(event) => updateCategory(index, "name", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Collection to open<select value={category.slug} onChange={(event) => updateCategory(index, "slug", event.target.value)} className={inputClass}>{!collectionOptions.some((option) => option.slug === category.slug) && <option value={category.slug}>Unavailable: {category.slug}</option>}{collectionOptions.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label><label className="block text-[10px] font-medium text-[#716a60]">Image alt text<input value={category.alt} onChange={(event) => updateCategory(index, "alt", event.target.value)} className={inputClass} /></label><label className="flex items-center gap-2 pt-5 text-[10px] text-[#716a60]"><input type="checkbox" checked={category.active} onChange={(event) => updateCategory(index, "active", event.target.checked)} /> Show category</label></div></div></PanelCard>)}</div>
        <div><SectionHeading title="New arrivals" description="Feature active products on the homepage. Add products and upload their images in Products, then select them here." action={<div className="flex gap-2"><Button variant="quiet" disabled={!content.newArrivals.productIds.length} onClick={() => setContent((current) => ({ ...current, newArrivals: { ...current.newArrivals, productIds: [] } }))}>Clear selection</Button><Button variant="secondary" onClick={() => setContent((current) => ({ ...current, newArrivals: { ...current.newArrivals, active: true, productIds: [...DEFAULT_HOMEPAGE_CONTENT.newArrivals.productIds] } }))}>Restore sample selection</Button></div>} /><PanelCard className="mb-3 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-medium text-[#716a60]">Section title<input maxLength={80} value={content.newArrivals.title} onChange={(event) => setContent((current) => ({ ...current, newArrivals: { ...current.newArrivals, title: event.target.value } }))} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Eyebrow text<input maxLength={80} value={content.newArrivals.eyebrow} onChange={(event) => setContent((current) => ({ ...current, newArrivals: { ...current.newArrivals, eyebrow: event.target.value } }))} className={inputClass} /></label><label className="flex items-center gap-2 text-[10px] text-[#716a60] sm:col-span-2"><input type="checkbox" checked={content.newArrivals.active} onChange={(event) => setContent((current) => ({ ...current, newArrivals: { ...current.newArrivals, active: event.target.checked } }))} /> Show New Arrivals on the homepage and in collection filters</label></div></PanelCard><PanelCard className="divide-y divide-[#f0ece6]">{productOptions.map((product) => <label key={product.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-[11px] text-[#34312c]"><input type="checkbox" checked={content.newArrivals.productIds.includes(product.id)} disabled={!content.newArrivals.productIds.includes(product.id) && content.newArrivals.productIds.length >= 30} onChange={(event) => setContent((current) => ({ ...current, newArrivals: { ...current.newArrivals, productIds: event.target.checked ? [...current.newArrivals.productIds, product.id] : current.newArrivals.productIds.filter((id) => id !== product.id) } }))} /><span>{product.name}</span>{content.newArrivals.productIds.includes(product.id) && <span className="ml-auto text-[9px] text-[#737373]">Selected for collection</span>}</label>)}{productOptions.length === 0 && <p className="p-4 text-[11px] text-[#737373]">No products are available to feature.</p>}</PanelCard></div>
        <div><SectionHeading title="Hot deal cards" description="Choose active products, upload deal imagery, and manage what appears on the homepage." action={<div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={!productOptions.length || content.hotDeals.length >= 30} onClick={addDeal}><Plus size={14} /> Add deal</Button><Button variant="secondary" onClick={() => setContent((current) => ({ ...current, hotDealsActive: true, hotDeals: [...DEFAULT_HOMEPAGE_CONTENT.hotDeals] }))}>Restore sample deals</Button></div>} /><PanelCard className="mb-3 p-4"><label className="flex items-center gap-2 text-[10px] text-[#716a60]"><input type="checkbox" checked={content.hotDealsActive} onChange={(event) => setContent((current) => ({ ...current, hotDealsActive: event.target.checked }))} /> Show Hot Deals section on site</label></PanelCard>{content.hotDeals.map((deal, index) => <PanelCard key={`deal-${index}`} className="mb-3 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#38352f]">Deal {index + 1}</h3><label className="flex items-center gap-2 text-[10px] text-[#716a60]"><input type="checkbox" checked={deal.active} onChange={(event) => updateDeal(index, "active", event.target.checked)} /> Show on site</label><Button variant="quiet" className="min-h-8 px-3 text-[10px] text-[#9d5548]" onClick={() => setContent((current) => ({ ...current, hotDeals: current.hotDeals.filter((_, row) => row !== index) }))}><Trash2 size={12} /> Remove deal</Button></div><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><HomepageImageField label={`${deal.name} image URL or upload`} value={deal.image} onChange={(value) => updateDeal(index, "image", value)} /><div className="grid content-start gap-3 sm:grid-cols-2"><label className="block text-[10px] font-medium text-[#716a60] sm:col-span-2">Linked product<select value={deal.productId} onChange={(event) => updateDeal(index, "productId", event.target.value)} className={inputClass}>{productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="block text-[10px] font-medium text-[#716a60]">Card title<input value={deal.name} onChange={(event) => updateDeal(index, "name", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Category label<input value={deal.category} onChange={(event) => updateDeal(index, "category", event.target.value)} className={inputClass} /></label><div className="text-[10px] font-medium text-[#716a60]">Current price from product<p className="mt-1.5 flex h-10 items-center rounded-lg border border-[#e9e4dc] bg-[#f7f7f7] px-3 text-[11px] text-[#454139]">BDT {(productOptions.find((product) => product.id === deal.productId)?.currentPrice ?? deal.price) / 100}</p></div><label className="block text-[10px] font-medium text-[#716a60]">Reference price (BDT)<input type="number" value={deal.was / 100} onChange={(event) => updateDeal(index, "was", Number(event.target.value) * 100)} className={inputClass} /><span className="mt-1 block text-[9px] font-normal text-[#928a7e]">Checkout price follows the linked product. Set its selling and original prices in Products.</span></label><label className="block text-[10px] font-medium text-[#716a60] sm:col-span-2">Image alt text<input value={deal.alt} onChange={(event) => updateDeal(index, "alt", event.target.value)} className={inputClass} /></label></div></div></PanelCard>)}</div>
      </div>
      <div className="mt-5 flex justify-end"><Button disabled={saving} onClick={() => void save()}><Check size={14} /> {saving ? "Saving…" : "Save homepage content"}</Button></div>
    </>}
  </>;
}

function AnalyticsPage() {
  type Report = { year: number; months: { month: number; revenue: number; knownCost: number; profit: number; orderCount: number; missingCostItems: number }[]; totals: { revenue: number; knownCost: number; grossProfit: number | null; partialProfit: number; orderCount: number; missingCostItems: number } };
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/admin/profit?year=${year}`, { cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load profit report."); return result as Report; })
      .then((result) => { if (active) { setReport(result); setError(""); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load profit report."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year]);
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() : 0;
  const month = report?.months[currentMonth];
  const maxRevenue = Math.max(1, ...(report?.months.map((item) => item.revenue) ?? [1]));
  const monthName = new Intl.DateTimeFormat("en", { month: "short" });
  const stats = [
    { label: "Sales this month", value: month ? money(month.revenue) : "—", detail: `${month?.orderCount ?? 0} orders` },
    { label: "Gross profit this month", value: month?.missingCostItems ? "Incomplete" : month ? money(month.profit) : "—", detail: month?.missingCostItems ? `${month.missingCostItems} items need cost data` : "Sales less product cost" },
    { label: `Sales in ${year}`, value: report ? money(report.totals.revenue) : "—", detail: `${report?.totals.orderCount ?? 0} active or completed orders` },
    { label: `Gross profit in ${year}`, value: report?.totals.grossProfit == null ? report ? "Incomplete" : "—" : money(report.totals.grossProfit), detail: report?.totals.missingCostItems ? `${report.totals.missingCostItems} items need cost data` : "Sales less product cost" },
  ];
  return <><SectionHeading title="Sales &amp; profit" description="Track confirmed product sales, saved unit costs, and gross profit by month and year." action={<label className="flex items-center gap-2 rounded-lg border border-[#e9e4dc] bg-white px-3 py-2 text-[10px] text-[#716a60]"><CalendarDays size={14} /> Year <select aria-label="Report year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="bg-transparent font-medium text-[#48443d] outline-none">{Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((value) => <option key={value}>{value}</option>)}</select></label>} />
    {error && <div className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-4 text-[11px] text-[#8f493b]">{error}{error.includes("not configured") && <p className="mt-1 text-[10px]">Configure Supabase, apply all migrations, and add product unit costs to start reporting.</p>}</div>}
    {report?.totals.missingCostItems ? <div className="mb-4 rounded-lg border border-[#eadfc8] bg-[#fbf6ea] p-3 text-[10px] text-[#806744]">Profit is incomplete because {report.totals.missingCostItems} sold line items do not have a saved unit cost. Add costs to products; historic order lines need their original costs entered to complete those periods.</div> : null}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <PanelCard key={stat.label} className="p-4"><p className="text-[10px] text-[#8f887e]">{stat.label}</p><strong className="mt-2 block text-[20px] text-[#34312c]">{loading ? "Loading…" : stat.value}</strong><p className="mt-1 text-[9px] text-[#9a9388]">{stat.detail}</p></PanelCard>)}</div>
    <PanelCard className="mb-4 p-5"><div className="flex items-start justify-between"><div><h2 className="text-[13px] font-semibold text-[#34312c]">Monthly sales and gross profit</h2><p className="mt-1 text-[10px] text-[#a09a90]">Revenue excludes delivery fees; gross profit subtracts product costs.</p></div><div className="flex gap-3 text-[9px] text-[#827b70]"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#bd8547]" />Sales</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#d9c8ad]" />Profit</span></div></div><div className="mt-5 grid h-56 grid-cols-6 items-end gap-2 border-b border-[#f0ece6] px-1 sm:grid-cols-12 sm:gap-3">{(report?.months ?? Array.from({ length: 12 }, (_, index) => ({ month: index + 1, revenue: 0, profit: 0, missingCostItems: 0 }))).map((item) => <div key={item.month} className="flex h-full flex-col items-center justify-end gap-2"><div className="flex h-[85%] w-full items-end justify-center gap-0.5">{item.revenue > 0 && <div title={`Sales ${money(item.revenue)}`} className="w-1/2 max-w-5 rounded-t bg-[#bd8547]" style={{ height: `${Math.max(4, item.revenue / maxRevenue * 100)}%` }} />}{item.profit > 0 && <div title={`Gross profit ${money(item.profit)}`} className="w-1/2 max-w-5 rounded-t bg-[#d9c8ad]" style={{ height: `${Math.max(4, item.profit / maxRevenue * 100)}%` }} />}</div><span className="mb-2 text-[9px] text-[#aaa399]">{monthName.format(new Date(year, item.month - 1, 1))}</span></div>)}</div>{!loading && report?.totals.orderCount === 0 && <p className="pt-4 text-center text-[10px] text-[#928a7e]">No fulfilled orders are recorded for {year} yet.</p>}</PanelCard>
    <PanelCard className="overflow-hidden"><div className="border-b border-[#f0ece6] px-5 py-4"><h2 className="text-[13px] font-semibold text-[#34312c]">Monthly breakdown</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[10px]"><thead className="bg-white uppercase tracking-[.08em] text-[#948c80]"><tr>{["Month", "Orders", "Product sales", "Known cost", "Gross profit"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{report?.months.map((item) => <tr key={item.month} className="border-t border-[#f3f0ea] text-[#625d55]"><td className="px-5 py-3 font-medium text-[#48443d]">{new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(year, item.month - 1, 1))}</td><td className="px-5 py-3">{item.orderCount}</td><td className="px-5 py-3">{money(item.revenue)}</td><td className="px-5 py-3">{money(item.knownCost)}</td><td className="px-5 py-3 font-semibold">{item.missingCostItems ? "Incomplete" : money(item.profit)}</td></tr>)}</tbody></table></div></PanelCard>
  </>;
}

type StoreProfileSettings = { name: string; contact_email: string; phone: string; currency: string; country: string };

function SettingsPage() {
  const [settings, setSettings] = useState<StoreProfileSettings>({ name: "", contact_email: "", phone: "", currency: "BDT", country: "Bangladesh" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch("/api/admin/settings", { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Store settings could not be loaded.");
      return result.settings as StoreProfileSettings;
    }).then((data) => { if (active) setSettings(data); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Store settings could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Store settings could not be saved.");
      setNotice("Store profile saved in Supabase.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Store settings could not be saved."); }
    finally { setSaving(false); }
  };
  const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a] disabled:bg-[#f6f4f0]";
  return <>
    <SectionHeading title="Settings" description="Store profile settings saved in Supabase." />
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] text-[#8f493b]">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-[#d7e4d2] bg-[#f2f6ef] p-3 text-[11px] text-[#587052]">{notice}</p>}
    <PanelCard className="p-5 sm:p-6"><h2 className="text-[14px] font-semibold text-[#38352f]">Store profile</h2><p className="mt-1 text-[10px] text-[#9a9388]">Contact details and the supported storefront currency.</p>
      <form onSubmit={save} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-[10px] font-medium text-[#716a60]">Store name<input required maxLength={120} disabled={loading} value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} className={fieldClass} /></label>
        <label className="text-[10px] font-medium text-[#716a60]">Contact email<input type="email" maxLength={254} disabled={loading} value={settings.contact_email} onChange={(event) => setSettings({ ...settings, contact_email: event.target.value })} className={fieldClass} /></label>
        <label className="text-[10px] font-medium text-[#716a60]">Phone<input type="tel" maxLength={40} disabled={loading} value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} className={fieldClass} /></label>
        <label className="text-[10px] font-medium text-[#716a60]">Currency<input disabled value="BDT ? Bangladeshi Taka" className={fieldClass} /></label>
        <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={loading || saving}>{saving ? "Saving?" : "Save changes"}</Button></div>
      </form>
      <p className="mt-5 rounded-lg border border-[#eee8de] bg-white p-3 text-[10px] text-[#827b70]"><ShieldCheck className="mr-2 inline text-[#829679]" size={14} />Online card and bKash payment processing is not configured. Checkout saves orders as pending.</p>
    </PanelCard>
  </>;
}

export default function AdminPanel() {
  const [page, setPage] = useState<PanelKey>("Overview");
  const [globalSearch, setGlobalSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [adminSessionState, setAdminSessionState] = useState<AdminSessionState>("checking");
  const [adminEmail, setAdminEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginName, setLoginName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [loginError, setLoginError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) {
      setAdminSessionState("unconfigured");
      return;
    }

    let active = true;
    const applySession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!active) return;
      if (!session) {
        setAdminEmail("");
        setAdminSessionState("signed-out");
        return;
      }
      setAdminEmail(session.user.email ?? "");
      setAdminSessionState(session.user.app_metadata?.role === "admin" ? "ready" : "not-admin");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setLoginError("Could not read your Supabase session. Refresh this page and try again.");
        setAdminSessionState("signed-out");
        return;
      }
      applySession(data.session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const submitAdminAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setAuthNotice("");
    setLoginPending(true);
    const client = createSupabaseBrowserClient();
    if (!client) {
      setLoginError("Supabase browser settings are missing from this frontend build. Configure the public Supabase URL and publishable key, then rebuild and restart the frontend.");
      setAdminSessionState("unconfigured");
      setLoginPending(false);
      return;
    }

    if (authMode === "signup") {
      if (loginPassword.length < 8) {
        setLoginError("Choose a password with at least 8 characters.");
        setLoginPending(false);
        return;
      }
      if (loginPassword !== confirmPassword) {
        setLoginError("Your passwords do not match.");
        setLoginPending(false);
        return;
      }

      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", "/admin");
      callback.searchParams.set("audience", "admin");
      const { data, error } = await client.auth.signUp({
        email: loginEmail.trim(),
        password: loginPassword,
        options: { emailRedirectTo: callback.toString(), data: { full_name: loginName.trim() } },
      });
      setLoginPending(false);
      if (error) {
        setLoginError(error.message);
        return;
      }

      setLoginPassword("");
      setConfirmPassword("");
      setAuthMode("signin");
      setAdminSessionState(data.session ? "not-admin" : "signed-out");
      setAuthNotice(data.session
        ? "Your account was created. It does not have admin access yet. Grant the trusted admin role, then sign in again here."
        : "Your account was created. Confirm your email if Supabase asks, grant the trusted admin role, then sign in here.");
      return;
    }

    const { data, error } = await client.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    setLoginPending(false);
    if (error) {
      setLoginError(error.message);
      return;
    }
    if (data.user?.app_metadata?.role !== "admin") {
      setAdminEmail(data.user?.email ?? loginEmail.trim());
      setAdminSessionState("not-admin");
      setLoginError("This account can sign in, but it does not have the trusted admin role. Ask the project owner to grant app_metadata.role = admin.");
      return;
    }
    setAdminEmail(data.user.email ?? loginEmail.trim());
    setLoginPassword("");
    setAdminSessionState("ready");
  };

  const signOutOfAdmin = async () => {
    const client = createSupabaseBrowserClient();
    if (client) await client.auth.signOut({ scope: "local" });
    setAdminEmail("");
    setAdminSessionState("signed-out");
    setPage("Overview");
  };

  const pageDescriptions: Record<PanelKey, string> = { Overview: "Store performance at a glance", Orders: "Manage orders and fulfillment", "Custom requests": "Review customer ideas and reference material", Products: "Manage your product catalogue", Categories: "Organize your catalogue", Customers: "Customer directory and activity", Reviews: "Customer product feedback", Coupons: "Discounts and promotions", Rewards: "Customer loyalty programme", "Media library": "Images used in your store", "Homepage content": "Manage hero, category, and hot deal imagery", Analytics: "Store performance and trends", Settings: "Store preferences and team access" };
  const Content = useMemo(() => {
    switch (page) {
      case "Orders": return <OrdersPage />;
      case "Custom requests": return <CustomRequestsPage />;
      case "Products": return <ProductsPage />;
      case "Categories": return <CategoriesPage />;
      case "Customers": return <CustomersPage />;
      case "Reviews": return <ReviewsPage />;
      case "Coupons": return <CouponsPage />;
      case "Rewards": return <RewardsPage />;
      case "Media library": return <MediaPage />;
      case "Homepage content": return <HomepageContentPage />;
      case "Analytics": return <AnalyticsPage />;
      case "Settings": return <SettingsPage />;
      default: return <Overview onNavigate={setPage} />;
    }
  }, [page]);
  const renderNav = (group: "Store" | "Engage" | "Manage") => <div className="mb-5"><p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.16em] text-[#858585]">{group}</p><div className="space-y-0.5">{navigation.filter((item) => item.group === group).map(({ label, icon: Icon }) => <button key={label} onClick={() => { setPage(label); setMobileMenu(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] transition ${page === label ? "bg-[#171717] font-semibold text-white" : "text-[#555555] hover:bg-[#f3f3f3] hover:text-black"}`}><Icon size={15} strokeWidth={1.8} />{label}</button>)}</div></div>;

  if (adminSessionState !== "ready") {
    const statusMessage = adminSessionState === "checking"
      ? "Checking your Supabase session…"
      : adminSessionState === "unconfigured"
        ? "Supabase browser settings are missing from this frontend build. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild and restart the frontend."
        : adminSessionState === "not-admin"
          ? "You are signed in, but this account does not have the trusted Supabase admin role."
          : "Sign in here to open your admin workspace. You will stay on this admin page.";

    return <div className="admin-panel flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-10 text-[#171717] [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
      <main className="w-full max-w-[440px] rounded-2xl border border-[#ece6dd] bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-8 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252723] text-[#d6b17a]"><span className="font-serif text-[17px]">C</span></div><div><p className="text-[12px] font-semibold tracking-[.04em] text-[#312e28]">CLOUD LAMPS</p><p className="mt-0.5 text-[8px] font-medium uppercase tracking-[.2em] text-[#9b7547]">Store admin</p></div></div>
        <p className="mb-2 text-[9px] font-medium uppercase tracking-[.16em] text-[#a77b47]">Admin workspace</p>
        <h1 className="font-serif text-[28px]">{adminSessionState === "checking" ? "Opening admin" : "Sign in to admin"}</h1>
        <p className="mt-2 text-[12px] leading-5 text-[#777168]">{statusMessage}</p>
        {adminSessionState === "checking" && <p className="mt-6 animate-pulse text-[12px] text-[#8d6437]">Please wait…</p>}
        {(adminSessionState === "signed-out" || adminSessionState === "not-admin") && <form onSubmit={submitAdminAuth} className="mt-6 space-y-4">
          {authMode === "signup" && <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-[#4a463f]">Full name</span><input required autoComplete="name" value={loginName} onChange={(event) => setLoginName(event.target.value)} className="h-11 w-full rounded-lg border border-[#e8e0d4] px-3 text-[12px] outline-none focus:border-[#a67c3d]" /></label>}
          <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-[#4a463f]">Email</span><input required type="email" autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="h-11 w-full rounded-lg border border-[#e8e0d4] px-3 text-[12px] outline-none focus:border-[#a67c3d]" /></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-[#4a463f]">Password</span><input required minLength={authMode === "signup" ? 8 : undefined} type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="h-11 w-full rounded-lg border border-[#e8e0d4] px-3 text-[12px] outline-none focus:border-[#a67c3d]" /></label>
          {authMode === "signup" && <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-[#4a463f]">Confirm password</span><input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-lg border border-[#e8e0d4] px-3 text-[12px] outline-none focus:border-[#a67c3d]" /></label>}
          {authNotice && <p role="status" className="rounded-lg border border-[#d9e4d3] bg-[#f3f7f0] p-3 text-[11px] leading-5 text-[#536c4e]">{authNotice}</p>}
          {loginError && <p role="alert" className="rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] leading-5 text-[#8f493b]">{loginError}</p>}
          <button type="submit" disabled={loginPending} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#171717] px-4 text-[12px] font-semibold text-white transition hover:bg-[#333] disabled:cursor-wait disabled:opacity-50">{loginPending ? authMode === "signup" ? "Creating account…" : "Signing in…" : authMode === "signup" ? "Create account" : "Sign in to admin"}</button>
          <p className="text-center text-[11px] text-[#777168]">{authMode === "signup" ? "Already registered?" : "Need an account?"} <button type="button" onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setLoginError(""); setAuthNotice(""); }} className="font-semibold text-[#8d6437] underline underline-offset-4">{authMode === "signup" ? "Sign in" : "Create one"}</button></p>
        </form>}
        {adminSessionState === "unconfigured" && <p role="alert" className="mt-6 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-3 text-[11px] leading-5 text-[#8f493b]">{loginError || statusMessage}</p>}
        {adminSessionState === "not-admin" && adminEmail && <p className="mt-4 text-[10px] text-[#928a7f]">Signed in as {adminEmail}</p>}
        <a href="/" className="mt-7 inline-flex text-[11px] font-medium text-[#8d6437] underline underline-offset-4">Return to the storefront</a>
      </main>
    </div>;
  }

  return <div className="admin-panel min-h-screen bg-[#f7f7f7] text-[#171717] [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
    {mobileMenu && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileMenu(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[238px] flex-col border-r border-[#ece6dd] bg-white px-3 transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}><div className="flex h-[68px] items-center gap-3 border-b border-[#eee8df] px-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#252723] text-[#d6b17a]"><span className="font-serif text-[16px]">C</span></div><div><p className="text-[12px] font-semibold tracking-[.04em] text-[#312e28]">CLOUD LAMPS</p><p className="mt-0.5 text-[8px] font-medium uppercase tracking-[.2em] text-[#9b7547]">Store studio</p></div><span className="ml-auto rounded-md border border-[#e9e2d7] px-1.5 py-1 text-[8px] uppercase tracking-wider text-[#827b70]">Admin</span></div><nav className="min-h-0 flex-1 overflow-y-auto px-1 pt-5">{renderNav("Store")}{renderNav("Engage")}{renderNav("Manage")}</nav><div className="border-t border-[#eee8df] px-2 py-3"><div className="flex items-center gap-2.5 rounded-lg p-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#775832]">{adminEmail.slice(0, 2).toUpperCase() || "AD"}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#49443c]">Store administrator</p><p className="truncate text-[9px] text-[#a09a90]">{adminEmail}</p></div><button type="button" onClick={() => void signOutOfAdmin()} className="rounded-md px-2 py-1 text-[9px] font-semibold text-[#8d6437] hover:bg-[#f7f4ef]">Sign out</button></div></div></aside>
    <div className="min-h-screen lg:pl-[238px]"><header className="sticky top-0 z-20 flex h-[62px] items-center gap-4 border-b border-[#ece6dd] bg-white/95 px-4 backdrop-blur sm:px-7"><button aria-label="Open navigation" onClick={() => setMobileMenu(true)} className="rounded-md p-2 text-[#716a60] hover:bg-white lg:hidden"><Menu size={18} /></button><div className="hidden items-center gap-2 text-[10px] text-[#a19a90] sm:flex"><span>Store</span><ChevronRight size={12} /><span className="font-medium text-[#4b463e]">{page}</span></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><label className="hidden h-9 w-[230px] items-center gap-2 rounded-lg border border-[#e9e4dc] bg-white px-2.5 text-[#9a9388] md:flex"><Search size={14} /><input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Search anything…" className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#aaa399]" /><kbd className="rounded border border-[#e9e4dc] px-1 py-0.5 text-[8px]">⌘ K</kbd></label><button aria-label="Notifications" className="relative rounded-lg p-2 text-[#777168] hover:bg-white"><Bell size={16} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#bd8547]" /></button><div className="hidden h-6 border-l border-[#e9e4dc] sm:block" /><button className="flex items-center gap-2 rounded-lg p-1 hover:bg-white"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-[#775832]">AD</span><ChevronDown size={12} className="text-[#827b70]" /></button></div></header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8"><div className="mb-6 flex items-center justify-between"><div><p className="text-[9px] font-medium uppercase tracking-[.16em] text-[#a77b47]">Cloud Lamps &amp; Mirrors <span className="px-1.5 text-[#c7b9a4]">/</span> Admin</p><p className="mt-1 text-[10px] text-[#aaa297]">{pageDescriptions[page]}</p></div><div className="hidden items-center gap-2 text-[9px] text-[#9a9388] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#9aaf8c]" />Admin workspace</div></div>{globalSearch && <div className="mb-4 rounded-lg border border-[#e8dfd2] bg-white px-4 py-2.5 text-[10px] text-[#716a60]">Search preview: “{globalSearch}” · Use the search field inside a section to filter its records.</div>}{Content}<footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-[#ece6dd] pt-4 text-[9px] text-[#aaa297]"><span>Cloud Lamps &amp; Mirrors · Store management</span><span className="flex items-center gap-1"><CircleHelp size={11} /> Admin mutations require your trusted Supabase admin role</span></footer></main></div>
  </div>;
}
