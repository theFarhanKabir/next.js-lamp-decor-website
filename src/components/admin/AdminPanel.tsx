"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BadgePercent, BarChart3,
  Bell, Boxes, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  CircleHelp, CreditCard, Download, Ellipsis, Eye, FileImage, Filter, Gift,
  LayoutDashboard, ListFilter, LockKeyhole, Menu, MessageSquareText, Package,
  Plus, Search, Settings2, ShieldCheck, ShoppingBag, Sparkles, Tag, TrendingUp,
  Users, X,
  type LucideIcon,
} from "lucide-react";
import { PRODUCTS } from "../../app/catalog";
import { createClient as createSupabaseBrowserClient } from "../../lib/supabase/client";
import { DEFAULT_HOMEPAGE_CONTENT, type HomepageContent, type HeroSlide, type HomeCategory, type HotDeal } from "../../app/homepage-content";

type PanelKey = "Overview" | "Orders" | "Custom requests" | "Products" | "Categories" | "Customers" | "Reviews" | "Coupons" | "Rewards" | "Media library" | "Homepage content" | "Analytics" | "Settings";
type OrderStatus = "Processing" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";

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

const topCategories = [
  { name: "Lamps", slug: "lamps", subcategories: ["Table Lamps", "Floor Lamps", "Pendant Lights", "Wall Lights"] },
  { name: "Mirrors", slug: "mirrors", subcategories: ["Wall Mirrors", "Full-Length Mirrors", "Vanity Mirrors"] },
  { name: "Tables", slug: "tables", subcategories: ["Side Tables", "Coffee Tables", "Console Tables", "Dining Tables"] },
  { name: "Shades", slug: "shades", subcategories: ["Lamp Shades", "Pendant Shades"] },
];

const orders: { id: string; customer: string; email: string; date: string; items: number; total: number; status: OrderStatus; method: string }[] = [
  { id: "CL-1048", customer: "Nadia Rahman", email: "nadia.r@email.com", date: "Oct 08, 2026", items: 2, total: 124000, status: "Processing", method: "Card" },
  { id: "CL-1047", customer: "Samir Hossain", email: "samir.h@email.com", date: "Oct 08, 2026", items: 1, total: 68000, status: "Confirmed", method: "Cash on delivery" },
  { id: "CL-1046", customer: "Ayesha Karim", email: "ayesha.k@email.com", date: "Oct 07, 2026", items: 3, total: 186000, status: "Shipped", method: "bKash" },
  { id: "CL-1045", customer: "Rafi Ahmed", email: "rafi.a@email.com", date: "Oct 07, 2026", items: 1, total: 54000, status: "Delivered", method: "Card" },
  { id: "CL-1044", customer: "Maliha Noor", email: "maliha.n@email.com", date: "Oct 06, 2026", items: 2, total: 92000, status: "Processing", method: "Cash on delivery" },
];

const customers = [
  { name: "Nadia Rahman", email: "nadia.r@email.com", orders: 8, spent: 428000, joined: "Sep 14, 2026", status: "Returning" },
  { name: "Samir Hossain", email: "samir.h@email.com", orders: 1, spent: 68000, joined: "Oct 08, 2026", status: "New" },
  { name: "Ayesha Karim", email: "ayesha.k@email.com", orders: 4, spent: 306000, joined: "Aug 22, 2026", status: "Returning" },
  { name: "Rafi Ahmed", email: "rafi.a@email.com", orders: 2, spent: 142000, joined: "Jul 03, 2026", status: "Returning" },
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
    ? "bg-[#bd8547] text-white hover:bg-[#a97439] shadow-[0_5px_14px_rgba(189,133,71,.16)]"
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
  return <section className={`rounded-xl border border-[#ece6dd] bg-white shadow-[0_3px_14px_rgba(50,39,25,.025)] ${className}`}>{children}</section>;
}

function SectionHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-[25px] font-semibold tracking-[-0.035em] text-[#282722]">{title}</h1><p className="mt-1.5 text-[12px] text-[#898277]">{description}</p></div>{action}</div>;
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="flex h-10 min-w-0 items-center gap-2.5 rounded-lg border border-[#e9e4dc] bg-white px-3 text-[#9b9388] focus-within:border-[#c9a06a]"><Search size={15} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[12px] text-[#34312c] outline-none placeholder:text-[#aaa399]" /></label>;
}

function Overview({ onNavigate }: { onNavigate: (page: PanelKey) => void }) {
  const topProducts = PRODUCTS.slice(0, 5);
  const stats = [
    { label: "Gross sales", value: "৳8,42,500", change: "+12.8%", icon: CreditCard, good: true },
    { label: "Orders", value: "148", change: "+8.2%", icon: ShoppingBag, good: true },
    { label: "Average order", value: "৳5,693", change: "+3.4%", icon: TrendingUp, good: true },
    { label: "Products in stock", value: "36", change: "4 low stock", icon: Boxes, good: false },
  ];
  const bars = [34, 43, 37, 54, 45, 67, 56, 74, 60, 69, 49, 82, 66, 91, 73, 62, 87, 74, 97, 77, 90, 69, 80, 100, 83, 92, 72, 88];
  return <>
    <SectionHeading title="Good morning, admin" description="Here’s what’s happening at Cloud Lamps & Mirrors today." action={<Button variant="secondary"><CalendarDays size={14} /> Last 28 days <ChevronDown size={13} /></Button>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <PanelCard key={stat.label} className="p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-medium text-[#827b70]">{stat.label}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#aa7940]"><stat.icon size={15} /></span></div><div className="mt-4 flex items-end justify-between gap-2"><strong className="text-[22px] font-semibold tracking-[-0.04em] text-[#282722]">{stat.value}</strong><span className={`mb-1 flex items-center gap-1 text-[10px] ${stat.good ? "text-[#648466]" : "text-[#a8792f]"}`}>{stat.good ? <ArrowUpRight size={12} /> : <Activity size={12} />}{stat.change}</span></div><p className="mt-1 text-[10px] text-[#a09a90]">Compared with previous period</p></PanelCard>)}</div>
    <div className="mb-5 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <PanelCard className="p-5"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-[13px] font-semibold text-[#34312c]">Sales over time</h2><p className="mt-1 text-[10px] text-[#a09a90]">Daily revenue · Last 28 days</p></div><button className="rounded-md border border-[#eee9e1] px-2.5 py-1.5 text-[10px] text-[#746d63]">Daily <ChevronDown className="ml-2 inline" size={11} /></button></div><div className="flex h-[180px] items-end gap-1 border-b border-[#f0ece6] px-1 pb-2 sm:gap-2">{bars.map((height, i) => <div key={i} title={`৳${(height * 215).toLocaleString()}`} className={`flex-1 rounded-t-[3px] transition-colors ${i === 23 ? "bg-[#bd8547]" : "bg-[#e9d9c3] hover:bg-[#d1af82]"}`} style={{ height: `${height}%` }} />)}</div><div className="mt-2 flex justify-between text-[9px] text-[#aaa399]"><span>Sep 10</span><span>Sep 17</span><span>Sep 24</span><span>Oct 1</span><span>Oct 8</span></div></PanelCard>
      <PanelCard className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[13px] font-semibold text-[#34312c]">Order status</h2><p className="mt-1 text-[10px] text-[#a09a90]">148 orders this period</p></div><Ellipsis size={17} className="text-[#9c9489]" /></div><div className="space-y-[18px]">{[{ name: "Delivered", value: 64, count: 95, color: "bg-[#7d9a7a]" }, { name: "Processing", value: 18, count: 27, color: "bg-[#d0a45f]" }, { name: "Shipped", value: 12, count: 18, color: "bg-[#8d9bad]" }, { name: "Cancelled", value: 6, count: 8, color: "bg-[#d29a8d]" }].map((item) => <div key={item.name}><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-[#635e56]">{item.name}</span><span className="text-[#8b847a]">{item.count} <span className="text-[#b0a99e]">· {item.value}%</span></span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#f1f2f4]"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} /></div></div>)}</div></PanelCard>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <PanelCard><div className="flex items-center justify-between border-b border-[#f0ece6] px-5 py-4"><div><h2 className="text-[13px] font-semibold text-[#34312c]">Recent orders</h2><p className="mt-1 text-[10px] text-[#a09a90]">The latest activity from your store</p></div><button onClick={() => onNavigate("Orders")} className="text-[11px] font-semibold text-[#9b6b38] hover:text-[#6f4c28]">View all <ArrowUpRight className="ml-1 inline" size={13} /></button></div><div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left"><thead><tr className="bg-white text-[9px] uppercase tracking-[.11em] text-[#948c80]"><th className="px-5 py-3 font-semibold">Order</th><th className="px-3 py-3 font-semibold">Customer</th><th className="px-3 py-3 font-semibold">Total</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody>{orders.slice(0, 4).map((order) => <tr key={order.id} className="border-t border-[#f3f0ea] text-[11px]"><td className="px-5 py-3 font-semibold text-[#48443d]">{order.id}<p className="mt-1 text-[9px] font-normal text-[#a19a90]">{order.date}</p></td><td className="px-3 py-3 text-[#5a554d]">{order.customer}</td><td className="px-3 py-3 font-medium text-[#38352f]">{money(order.total)}</td><td className="px-5 py-3"><StatusPill>{order.status}</StatusPill></td></tr>)}</tbody></table></div></PanelCard>
      <PanelCard><div className="flex items-center justify-between border-b border-[#f0ece6] px-5 py-4"><div><h2 className="text-[13px] font-semibold text-[#34312c]">Top selling products</h2><p className="mt-1 text-[10px] text-[#a09a90]">Best performers this month</p></div><button onClick={() => onNavigate("Products")} className="text-[11px] font-semibold text-[#9b6b38]">All products <ArrowUpRight className="ml-1 inline" size={13} /></button></div><div className="space-y-3 p-4">{topProducts.map((product, i) => <div key={product.id} className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[10px] font-semibold text-[#9b6b38]">0{i + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium text-[#4a463f]">{product.name}</p><p className="mt-0.5 text-[9px] text-[#9c958a]">{product.subcategory}</p></div><span className="text-[10px] font-semibold text-[#5f5a52]">{money(product.salePrice ?? product.basePrice)}</span></div>)}</div></PanelCard>
    </div>
  </>;
}

function OrdersPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All orders");
  const filtered = orders.filter((order) => `${order.id} ${order.customer} ${order.email}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All orders" || order.status === filter));
  return <><SectionHeading title="Orders" description="Review, fulfill, and keep track of customer orders." action={<Button variant="secondary"><Download size={14} /> Export</Button>} /><PanelCard><div className="flex flex-wrap items-center gap-2 border-b border-[#f0ece6] p-4"><div className="w-full sm:max-w-[300px]"><SearchField value={query} onChange={setQuery} placeholder="Search by order or customer…" /></div><div className="flex flex-1 justify-end gap-2"><select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#5a554d] outline-none"><option>All orders</option>{["Processing", "Confirmed", "Shipped", "Delivered", "Cancelled"].map((status) => <option key={status}>{status}</option>)}</select><Button variant="secondary"><Filter size={13} /> Filter</Button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Order", "Customer", "Date", "Items", "Total", "Payment", "Status", ""].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{filtered.map((order) => <tr key={order.id} className="border-t border-[#f3f0ea] text-[11px] hover:bg-white"><td className="px-4 py-4 font-semibold text-[#48443d]">{order.id}</td><td className="px-4 py-4"><p className="font-medium text-[#48443d]">{order.customer}</p><p className="mt-1 text-[9px] text-[#9c958a]">{order.email}</p></td><td className="px-4 py-4 text-[#756f65]">{order.date}</td><td className="px-4 py-4 text-[#756f65]">{order.items} items</td><td className="px-4 py-4 font-semibold text-[#48443d]">{money(order.total)}</td><td className="px-4 py-4 text-[#756f65]">{order.method}</td><td className="px-4 py-4"><StatusPill>{order.status}</StatusPill></td><td className="px-4 py-4"><button aria-label={`View ${order.id}`} className="rounded-md p-2 text-[#827b70] hover:bg-white"><Eye size={15} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="p-10 text-center text-xs text-[#928a7f]">No matching orders.</div>}</div><div className="flex items-center justify-between border-t border-[#f0ece6] px-4 py-3 text-[10px] text-[#958e83]">Showing {filtered.length} of {orders.length} orders<div className="flex gap-1"><button className="rounded border border-[#ece6dd] p-1.5"><ChevronLeft size={13} /></button><button className="rounded border border-[#ece6dd] p-1.5"><ChevronRight size={13} /></button></div></div></PanelCard></>;
}

type AdminProduct = { id: string; name: string; category: string; subcategory: string; category_slug?: string; subcategory_slug?: string; status: string; price_bdt: number; inventory_quantity: number; sku?: string; slug: string; product_images?: { public_url: string }[] };
type ProductSwatch = { label: string; color: string; imageUrl: string };

function ProductsPage({ onAdd: _onAdd }: { onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", sku: "", category_slug: "lamps", subcategory_name: "Table Lamps", short_description: "", description: "", price_bdt: "", cost_price_bdt: "", compare_at_price_bdt: "", inventory_quantity: "0", status: "draft", made_to_order: false, lead_time: "", dimensions: "", materials: "Oak Wood", sizes: "Small:0, Medium:6400, Large:12000", fabrics: "", legs: "", images: "", special_edition: false });
  const [swatches, setSwatches] = useState<ProductSwatch[]>([{ label: "Natural Oak", color: "#c8a96e", imageUrl: "" }]);
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/products", { cache: "no-store" });
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
    setForm({ name: product.name, slug: product.slug, sku: product.sku ?? "", category_slug: product.category_slug ?? "lamps", subcategory_name: product.subcategory ?? "", short_description: product.short_description ?? "", description: product.description ?? "", price_bdt: String(product.price_bdt ?? ""), cost_price_bdt: product.cost_price_bdt == null ? "" : String(product.cost_price_bdt), compare_at_price_bdt: String(product.compare_at_price_bdt ?? ""), inventory_quantity: String(product.inventory_quantity ?? 0), status: product.status ?? "draft", made_to_order: Boolean(product.made_to_order), lead_time: product.lead_time ?? "", dimensions: attrs.dimensions ?? "", materials: (attrs.materials ?? []).join(", "), sizes: options(attrs.sizes), fabrics: options(attrs.fabrics), legs: options(attrs.legs), images: (product.product_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((image: any) => image.public_url).join("\n"), special_edition: Boolean(attrs.special_edition) });
    setSwatches((product.swatches ?? []).map((swatch: any) => ({ label: swatch.label ?? "", color: swatch.color ?? "#c8a96e", imageUrl: swatch.imageUrl ?? "" })));
    setNotice(""); setEditing(true);
  };
  const field = (key: keyof typeof form, label: string, placeholder = "", type = "text") => <label className="block text-[10px] font-medium text-[#716a60]">{label}<input type={type} value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]" /></label>;
  const parseOptions = (value: string) => value.split(",").map((item) => { const [label, delta] = item.split(":"); return { label: label.trim(), delta: Number(delta) || 0 }; }).filter((item) => item.label);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice("");
    const attributes = { dimensions: form.dimensions, materials: form.materials.split(",").map((x) => x.trim()).filter(Boolean), sizes: parseOptions(form.sizes), fabrics: parseOptions(form.fabrics), legs: parseOptions(form.legs), special_edition: form.special_edition };
    const imageUrls = form.images.split(/\n|,/).map((url) => url.trim()).filter(Boolean);
    try {
      const response = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, attributes, swatches: swatches.filter((swatch) => swatch.label.trim()).map(({ label, color, imageUrl }) => ({ label: label.trim(), color, ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}) })), images: imageUrls.map((url, index) => ({ url, role: index ? "lifestyle" : "product", alt: form.name })) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Product could not be saved.");
      setNotice("Product saved to Supabase."); setEditing(false); await load();
    } catch (err) { setNotice(err instanceof Error ? err.message : "Product could not be saved."); }
    finally { setSaving(false); }
  };
  const changeStatus = async (slug: string, status: string) => {
    const response = await fetch("/api/admin/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, status }) });
    const result = await response.json(); if (!response.ok) setError(result.error || "Status update failed."); else await load();
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
    setForm({ name: "", slug: "", sku: "", category_slug: "lamps", subcategory_name: "Table Lamps", short_description: "", description: "", price_bdt: "", cost_price_bdt: "", compare_at_price_bdt: "", inventory_quantity: "0", status: "draft", made_to_order: false, lead_time: "", dimensions: "", materials: "Oak Wood", sizes: "Small:0, Medium:6400, Large:12000", fabrics: "", legs: "", images: "", special_edition: false });
    setSwatches([{ label: "Natural Oak", color: "#c8a96e", imageUrl: "" }]); setNotice(""); setEditing(true);
  };
  return <><SectionHeading title="Products" description="Manage product details, options, inventory, and storefront visibility." action={<Button onClick={beginNewProduct}><Plus size={15} /> Add product</Button>} />
    {error && <div className="mb-4 rounded-lg border border-[#ead4ca] bg-[#fff5f0] p-4 text-[12px] text-[#8f493b]">{error}{error.includes("administrator") && <p className="mt-1 text-[10px]">Sign in using an account with the trusted app_metadata.role = admin claim.</p>}{error.includes("not configured") && <p className="mt-1 text-[10px]">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then apply the store migrations.</p>}</div>}
    {notice && <div className="mb-4 rounded-lg border border-[#dce8d8] bg-[#f2f7ef] p-3 text-[11px] text-[#587052]">{notice}</div>}
    <PanelCard><div className="flex flex-wrap items-center gap-2 border-b border-[#f0ece6] p-4"><div className="w-full sm:max-w-[320px]"><SearchField value={query} onChange={setQuery} placeholder="Search products or SKU…" /></div><span className="ml-auto text-[10px] text-[#9a9388]">{loading ? "Loading…" : `${rows.length} products in Supabase`}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Product", "Category", "Price", "Inventory", "Status", "Storefront", ""].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{rows.map((p) => <tr key={p.id} className="border-t border-[#f3f0ea] text-[11px]"><td className="px-4 py-3"><div className="flex items-center gap-3">{p.product_images?.[0]?.public_url && <img src={p.product_images[0].public_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}<div><p className="font-semibold">{p.name}</p><p className="mt-1 text-[9px] text-[#9c958a]">{p.sku || p.slug}</p></div></div></td><td className="px-4 py-3">{p.category} · {p.subcategory}</td><td className="px-4 py-3">{money(Number(p.price_bdt))}</td><td className="px-4 py-3">{p.inventory_quantity}</td><td className="px-4 py-3"><StatusPill>{p.status === "active" ? "Active" : p.status === "archived" ? "Archived" : "Draft"}</StatusPill></td><td className="px-4 py-3"><select value={p.status} onChange={(e) => void changeStatus(p.slug, e.target.value)} className="rounded border border-[#e9e4dc] bg-white p-2 text-[10px]"><option value="draft">Draft</option><option value="active">Publish</option><option value="archived">Archive</option></select></td><td className="px-4 py-3"><button onClick={() => editProduct(p)} className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#8d6437] hover:bg-white">Edit</button></td></tr>)}</tbody></table>{!loading && rows.length === 0 && <p className="p-8 text-center text-[11px] text-[#928a7f]">{error ? "Connect Supabase to manage products." : "No saved products yet. Add your first product."}</p>}</div></PanelCard>
    {editing && <div role="presentation" className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(false); }}><form onSubmit={save} className="h-full w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">Add storefront product</h2><p className="mt-1 text-[11px] text-[#928a7e]">Product details, size pricing, finishes, dimensions, materials, and product media.</p></div><button type="button" onClick={() => setEditing(false)}><X size={18} /></button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{field("name", "Product name", "Cortez Outdoor Table")}{field("slug", "URL slug (optional)", "cortez-outdoor-table")}{field("sku", "SKU", "CL-0001")}<label className="block text-[10px] font-medium text-[#716a60]">Department<select value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border px-3 text-[11px]">{[["lamps","Lamps"],["mirrors","Mirrors"],["tables","Tables"],["shades","Shades"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="block text-[10px] font-medium text-[#716a60]">Subcategory<input value={form.subcategory_name} onChange={(e) => setForm({ ...form, subcategory_name: e.target.value })} placeholder="e.g. Table Lamps" className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]" /></label>{field("price_bdt", "Selling price (BDT)", "35300", "number")}{field("cost_price_bdt", "Unit cost (BDT)", "21000", "number")}{field("compare_at_price_bdt", "Original price (optional)", "47300", "number")}{field("inventory_quantity", "Stock quantity", "0", "number")}{field("lead_time", "Made to order lead time", "4–6 weeks")}{field("dimensions", "Dimensions", "W202 × D101 × H71 cm")}</div>
      <label className="mt-4 block text-[10px] font-medium text-[#716a60]">Short description<input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border px-3 text-[11px]" /></label><label className="mt-4 block text-[10px] font-medium text-[#716a60]">Full description<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5 w-full rounded-lg border p-3 text-[11px]" /></label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{field("sizes", "Sizes and price adjustment (Label:BDT delta, comma separated)", "Small:0, Medium:6400, Large:12000")}{field("fabrics", "Fabric options and price adjustment", "Linen:0, Velvet:5000")}{field("legs", "Leg/finish options and price adjustment", "Natural Oak:0, Walnut:1500")}{field("materials", "Filter materials (comma separated)", "Oak Wood, Brass")}</div>
            <section className="mt-5 rounded-xl border border-[#eee8df] bg-white p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-[12px] font-semibold text-[#48443d]">Colour finishes</h3><p className="mt-1 text-[10px] text-[#928a7e]">Choose a finish name, swatch colour, and the product photo customers should see for that finish.</p></div><button type="button" onClick={() => setSwatches((current) => [...current, { label: "", color: "#c8a96e", imageUrl: "" }])} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#e8dfd2] bg-white px-3 py-2 text-[10px] font-medium text-[#805d35]"><Plus size={13} /> Add finish</button></div><div className="space-y-3">{swatches.map((swatch, index) => <div key={index} className="grid gap-2 rounded-lg border border-[#eee8df] bg-white p-3 sm:grid-cols-[1fr_82px_1.4fr_auto] sm:items-end"><label className="block text-[9px] font-medium text-[#716a60]">Finish name<input value={swatch.label} onChange={(event) => setSwatches((current) => current.map((item, row) => row === index ? { ...item, label: event.target.value } : item))} placeholder="Natural Oak" className="mt-1 h-9 w-full rounded-md border border-[#e9e4dc] px-2 text-[11px] outline-none focus:border-[#c9a06a]" /></label><label className="block text-[9px] font-medium text-[#716a60]">Swatch<input type="color" value={swatch.color} onChange={(event) => setSwatches((current) => current.map((item, row) => row === index ? { ...item, color: event.target.value } : item))} className="mt-1 h-9 w-full rounded-md border border-[#e9e4dc] bg-white p-1" /></label><div><label className="inline-flex cursor-pointer items-center gap-1 text-[9px] text-[#8d6437]"><FileImage size={12} /> Upload finish image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { void uploadSwatchImage(index, event.target.files?.[0]); event.target.value = ""; }} className="sr-only" /></label></div><div className="flex items-center gap-2">{swatch.imageUrl && <><img src={swatch.imageUrl} alt={`${swatch.label || "Finish"} preview`} className="h-9 w-9 rounded-md object-cover" /><button type="button" onClick={() => setSwatches((current) => current.map((item, row) => row === index ? { ...item, imageUrl: "" } : item))} className="text-[9px] text-[#8d6437]">Remove image</button></>}<button type="button" aria-label="Remove colour finish" disabled={swatches.length === 1} onClick={() => setSwatches((current) => current.filter((_, row) => row !== index))} className="rounded-md px-2 py-2 text-[#948c80] hover:bg-white disabled:opacity-30"><X size={14} /></button></div></div>)}</div></section>
      <section className="mt-4"><label className="block text-[10px] font-medium text-[#716a60]">Upload product images<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(e) => void uploadImages(e)} className="mt-1.5 block w-full text-[11px]" />{uploading && <span className="mt-1 block text-[#8d6437]">Uploading…</span>}</label>{form.images && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{form.images.split(/\n|,/).filter(Boolean).map((url, index) => <div key={`${url}-${index}`} className="relative"><img src={url.trim()} alt={`${form.name || "Product"} photo ${index + 1}`} className="h-20 w-full rounded-md border border-[#e9e4dc] object-cover" /><button type="button" aria-label={`Remove product image ${index + 1}`} onClick={() => setForm((current) => ({ ...current, images: current.images.split(/\n|,/).map((item) => item.trim()).filter(Boolean).filter((_, itemIndex) => itemIndex !== index).join("\n") }))} className="absolute right-1 top-1 rounded-full bg-white px-2 py-1 text-[9px] shadow">Remove</button></div>)}</div>}<p className="mt-2 text-[9px] text-[#928a7e]">Upload JPG, PNG, WebP, or AVIF images. The first image is the main product photo.</p></section><div className="mt-4 flex flex-wrap gap-5 text-[11px]"><label><input type="checkbox" checked={form.made_to_order} onChange={(e) => setForm({ ...form, made_to_order: e.target.checked })} /> Made to order</label><label><input type="checkbox" checked={form.special_edition} onChange={(e) => setForm({ ...form, special_edition: e.target.checked })} /> Special edition</label><label><input type="checkbox" checked={form.status === "active"} onChange={(e) => setForm({ ...form, status: e.target.checked ? "active" : "draft" })} /> Publish immediately</label></div><div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-white py-4"><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={saving || uploading}>{saving ? "Saving…" : "Save product"}</Button></div></form></div>}
  </>;
}

function CategoriesPage({ onAdd }: { onAdd: () => void }) {
  const [active, setActive] = useState("Lamps");
  const selected = topCategories.find((category) => category.name === active) ?? topCategories[0];
  return <><SectionHeading title="Categories" description="Your four main departments stay fixed. Manage their subcategories here." action={<Button onClick={onAdd}><Plus size={15} /> Add subcategory</Button>} /><div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{topCategories.map((category) => <button key={category.slug} onClick={() => setActive(category.name)} className={`rounded-xl border p-4 text-left transition ${active === category.name ? "border-[#d8c2a4] bg-white shadow-[0_4px_15px_rgba(80,58,30,.05)]" : "border-[#ece6dd] bg-white hover:border-[#ded3c3]"}`}><span className="flex items-center justify-between"><span className="text-[12px] font-semibold text-[#38352f]">{category.name}</span><LockKeyhole size={13} className="text-[#a48a68]" /></span><span className="mt-2 block text-[10px] text-[#8f887e]">{category.subcategories.length} subcategories · Fixed</span></button>)}</div><PanelCard><div className="flex items-center justify-between border-b border-[#f0ece6] px-5 py-4"><div><h2 className="text-[13px] font-semibold text-[#34312c]">{selected.name} subcategories</h2><p className="mt-1 text-[10px] text-[#a09a90]">Products in this department can be assigned to one of these groups.</p></div><span className="rounded-md bg-white px-2.5 py-1.5 text-[10px] text-[#8c765a]">Parent category locked</span></div><div className="divide-y divide-[#f3f0ea]">{selected.subcategories.map((sub, i) => <div key={sub} className="flex items-center gap-3 px-5 py-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#a77c48]"><Tag size={15} /></div><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-[#48443d]">{sub}</p><p className="mt-1 text-[9px] text-[#a09a90]">{PRODUCTS.filter((p) => p.subcategory === sub).length + i + 2} products · /{selected.slug}/{sub.toLowerCase().replaceAll(" ", "-")}</p></div><StatusPill>Active</StatusPill><button aria-label={`Edit ${sub}`} className="rounded-md p-2 text-[#827b70] hover:bg-white"><Ellipsis size={16} /></button></div>)}</div></PanelCard><p className="mt-3 flex items-center gap-2 text-[10px] text-[#8e887e]"><LockKeyhole size={12} /> Main categories are protected. Add, rename, and organize subcategories without changing the store’s four main departments.</p></>;
}

function CustomersPage() {
  const [query, setQuery] = useState("");
  const list = customers.filter((customer) => `${customer.name} ${customer.email}`.toLowerCase().includes(query.toLowerCase()));
  return <><SectionHeading title="Customers" description="Understand customer activity and order history." action={<Button variant="secondary"><Download size={14} /> Export</Button>} /><PanelCard><div className="border-b border-[#f0ece6] p-4"><div className="max-w-[320px]"><SearchField value={query} onChange={setQuery} placeholder="Search customers…" /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Customer", "Orders", "Total spent", "Joined", "Segment"].map((x) => <th key={x} className="px-5 py-3 font-semibold">{x}</th>)}</tr></thead><tbody>{list.map((customer) => <tr key={customer.email} className="border-t border-[#f3f0ea] text-[11px]"><td className="px-5 py-4"><p className="font-semibold text-[#48443d]">{customer.name}</p><p className="mt-1 text-[9px] text-[#9c958a]">{customer.email}</p></td><td className="px-5 py-4 text-[#625d55]">{customer.orders}</td><td className="px-5 py-4 font-semibold text-[#48443d]">{money(customer.spent)}</td><td className="px-5 py-4 text-[#756f65]">{customer.joined}</td><td className="px-5 py-4"><StatusPill>{customer.status}</StatusPill></td></tr>)}</tbody></table></div></PanelCard></>;
}

type AdminReview = {
  id: string;
  product_slug: string | null;
  customer_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: "pending" | "published" | "hidden";
  created_at: string;
};

function ReviewsPage() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/reviews?admin=1", { cache: "no-store" })
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
      const response = await fetch("/api/reviews", {
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

  useEffect(() => {
    let active = true;
    setNotice("Loading submitted requests…");
    fetch("/api/custom-requests", { cache: "no-store" })
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

  return <>
    <SectionHeading title="Custom requests" description="Customer ideas, reference photos, and contact details in one inbox." action={<Button variant="secondary" onClick={() => setRefreshKey((key) => key + 1)}><Activity size={14} /> Refresh inbox</Button>} />
    {notice && <div className={`mb-4 rounded-lg border px-4 py-3 text-[11px] ${source === "preview" && notice.startsWith("Showing") ? "border-[#e9dfcd] bg-white text-[#806b4a]" : "border-[#ece6dd] bg-white text-[#8b8479]"}`}>{notice}</div>}
    <div className="mb-4 grid gap-3 sm:grid-cols-3">{[{ label: "Total requests", value: source === "live" ? String(requests.length) : "3" }, { label: "New to review", value: String(requests.filter((request) => request.status === "new").length) }, { label: "With reference photos", value: String(requests.filter((request) => request.images.length > 0).length) }].map((item) => <PanelCard key={item.label} className="p-4"><p className="text-[10px] text-[#8f887e]">{item.label}</p><p className="mt-2 text-[20px] font-semibold text-[#34312c]">{item.value}</p></PanelCard>)}</div>
    <PanelCard><div className="flex flex-wrap items-center gap-2 border-b border-[#f0ece6] p-4"><div className="w-full sm:max-w-[320px]"><SearchField value={query} onChange={setQuery} placeholder="Search name, email, or request…" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#5a554d] outline-none"><option>All requests</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="quoted">Quoted</option><option value="completed">Completed</option></select><span className="ml-auto text-[10px] text-[#9a9388]">{filtered.length} requests</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-white text-[9px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Request", "Customer", "Submitted", "References", "Status", ""].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{filtered.map((request) => <tr key={request.id} className="border-t border-[#f3f0ea] text-[11px] hover:bg-white"><td className="px-4 py-4 font-semibold text-[#48443d]">CR-{String(request.request_number).replace(/^CR-/, "")}<p className="mt-1 max-w-[210px] truncate text-[9px] font-normal text-[#9c958a]">{request.description}</p></td><td className="px-4 py-4"><p className="font-medium text-[#48443d]">{request.full_name}</p><p className="mt-1 text-[9px] text-[#9c958a]">{request.phone}</p></td><td className="px-4 py-4 text-[#756f65]">{displayDate(request.created_at)}</td><td className="px-4 py-4 text-[#756f65]">{request.images.length ? `${request.images.length} photo${request.images.length > 1 ? "s" : ""}` : "None"}</td><td className="px-4 py-4"><StatusPill>{displayStatus(request.status)}</StatusPill></td><td className="px-4 py-4"><button onClick={() => setSelected(request)} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#8d6437] hover:bg-white"><Eye size={13} /> View</button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="p-10 text-center text-xs text-[#928a7f]">No requests match your search.</div>}</div></PanelCard>
    {selected && <div role="presentation" className="fixed inset-0 z-50 flex justify-end bg-[#28241f]/35 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside role="dialog" aria-modal="true" aria-label={`Request from ${selected.full_name}`} className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ece6dd] bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><div><p className="text-[9px] font-medium uppercase tracking-[.15em] text-[#a77b47]">Custom request</p><h2 className="mt-1 text-[18px] font-semibold text-[#302d27]">CR-{String(selected.request_number).replace(/^CR-/, "")}</h2></div><div className="flex items-center gap-2"><StatusPill>{displayStatus(selected.status)}</StatusPill><button aria-label="Close request" onClick={() => setSelected(null)} className="rounded-md p-2 text-[#827b70] hover:bg-white"><X size={16} /></button></div></div><div className="space-y-5 p-5 sm:p-7"><PanelCard className="p-5"><h3 className="text-[12px] font-semibold text-[#34312c]">Customer information</h3><div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">{[{ label: "Full name", value: selected.full_name }, { label: "Phone number", value: selected.phone }, { label: "Email address", value: selected.email || "Not provided" }, { label: "City / area", value: selected.city_area }].map((field) => <div key={field.label}><p className="text-[9px] uppercase tracking-[.1em] text-[#a09a90]">{field.label}</p><p className="mt-1 text-[11px] font-medium text-[#48443d]">{field.value}</p></div>)}<div className="sm:col-span-2"><p className="text-[9px] uppercase tracking-[.1em] text-[#a09a90]">Delivery address</p><p className="mt-1 text-[11px] font-medium text-[#48443d]">{selected.delivery_address}</p></div></div></PanelCard><PanelCard className="p-5"><div className="flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#34312c]">Request description</h3><span className="text-[9px] text-[#a09a90]">Submitted {displayDate(selected.created_at)}</span></div><p className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-[#625d55]">{selected.description}</p></PanelCard><PanelCard className="p-5"><div className="flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#34312c]">Reference photos</h3><span className="text-[9px] text-[#a09a90]">{selected.images.length} attached</span></div>{selected.images.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{selected.images.map((image) => <a key={image.id} href={image.signed_url || "#"} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-[#ece6dd] bg-white"><div className="aspect-square overflow-hidden"><img src={image.signed_url || ""} alt={image.file_name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /></div><p className="truncate px-2.5 py-2 text-[9px] text-[#777168]">{image.file_name}</p></a>)}</div> : <p className="mt-3 text-[11px] text-[#928a7f]">No reference photos were attached.</p>}</PanelCard></div></aside></div>}
  </>;
}

function CouponsPage({ onAdd }: { onAdd: () => void }) {
  return <><SectionHeading title="Coupons" description="Create and monitor discounts for your customers." action={<Button onClick={onAdd}><Plus size={15} /> Create coupon</Button>} /><div className="grid gap-3 sm:grid-cols-3">{[{ code: "WELCOME10", offer: "10% off first order", used: "38 / 100", status: "Active" }, { code: "LIGHTING15", offer: "15% off lamps", used: "21 / 50", status: "Active" }, { code: "SUMMERHOME", offer: "৳1,000 off ৳10,000+", used: "50 / 50", status: "Archived" }].map((coupon) => <PanelCard key={coupon.code} className="overflow-hidden"><div className="border-b border-dashed border-[#e9e1d6] bg-white p-4"><div className="flex items-start justify-between"><span className="rounded-md border border-[#e7dbc8] bg-white px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-[#8d6437]">{coupon.code}</span><StatusPill>{coupon.status}</StatusPill></div><p className="mt-4 text-[14px] font-semibold text-[#39362f]">{coupon.offer}</p></div><div className="flex items-center justify-between p-4 text-[10px] text-[#8f887e]"><span>Redemptions</span><span className="font-semibold text-[#58534b]">{coupon.used}</span></div></PanelCard>)}</div></>;
}

function RewardsPage() {
  return <><SectionHeading title="Rewards" description="Encourage repeat visits with a simple points programme." action={<Button variant="secondary"><Settings2 size={14} /> Programme settings</Button>} /><div className="mb-4 grid gap-3 sm:grid-cols-3">{[{ label: "Members", value: "284" }, { label: "Points issued", value: "82,450" }, { label: "Points redeemed", value: "26,800" }].map((item) => <PanelCard key={item.label} className="p-4"><p className="text-[10px] text-[#8f887e]">{item.label}</p><p className="mt-2 text-[20px] font-semibold text-[#34312c]">{item.value}</p></PanelCard>)}</div><PanelCard className="p-6"><div className="flex items-start gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#a77b43]"><Sparkles size={19} /></div><div><h2 className="text-[13px] font-semibold text-[#34312c]">Cloud Rewards</h2><p className="mt-1 max-w-xl text-[11px] leading-5 text-[#80796f]">Customers earn 1 point per ৳100 spent. Every 100 points can be redeemed for ৳100 off a future order.</p><div className="mt-5 flex flex-wrap gap-5 text-[10px] text-[#8f887e]"><span>Programme <b className="ml-1 text-[#5d7c5e]">Active</b></span><span>Redemption <b className="ml-1 text-[#524e47]">100 points = ৳100</b></span></div></div></div></PanelCard></>;
}

function MediaPage() {
  const media = PRODUCTS.map((product) => ({ name: product.name, src: product.images.silo, category: product.subcategory }));
  return <><SectionHeading title="Media library" description="Product imagery currently shown across your catalogue." action={<Button><Plus size={15} /> Add media</Button>} /><div className="mb-4 flex flex-wrap gap-2"><Button variant="secondary"><ListFilter size={14} /> All media</Button><Button variant="quiet">Product images</Button><Button variant="quiet">Lifestyle</Button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{media.map((asset) => <PanelCard key={asset.src + asset.name} className="group overflow-hidden"><div className="relative aspect-square overflow-hidden bg-white"><img src={asset.src} alt={asset.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><button aria-label={`View ${asset.name}`} className="absolute right-2 top-2 rounded-md bg-white/90 p-2 text-[#625d55] opacity-0 shadow transition group-hover:opacity-100"><Eye size={13} /></button></div><div className="p-3"><p className="truncate text-[10px] font-semibold text-[#4a463f]">{asset.name}</p><p className="mt-1 text-[9px] text-[#9c958a]">{asset.category}</p></div></PanelCard>)}</div></>;
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

function HomepageContentPage() {
  const [content, setContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/homepage-content", { cache: "no-store" }).then((response) => response.json()), fetch("/api/catalog", { cache: "no-store" }).then((response) => response.json())])
      .then(([homepage, catalog]) => {
        if (!active) return;
        if (homepage.content?.heroSlides && homepage.content?.categories && homepage.content?.hotDeals) setContent(homepage.content);
        if (Array.isArray(catalog.products)) setProductOptions(catalog.products.map((product: any) => ({ id: product.id, name: product.name })));
      })
      .catch(() => { if (active) setError("Could not load homepage settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateHero = <K extends keyof HeroSlide,>(index: number, key: K, value: HeroSlide[K]) => setContent((current) => ({ ...current, heroSlides: current.heroSlides.map((slide, i) => i === index ? { ...slide, [key]: value } : slide) }));
  const updateCategory = <K extends keyof HomeCategory,>(index: number, key: K, value: HomeCategory[K]) => setContent((current) => ({ ...current, categories: current.categories.map((category, i) => i === index ? { ...category, [key]: value } : category) }));
  const updateDeal = <K extends keyof HotDeal,>(index: number, key: K, value: HotDeal[K]) => setContent((current) => ({ ...current, hotDeals: current.hotDeals.map((deal, i) => i === index ? { ...deal, [key]: value } : deal) }));
  const save = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/homepage-content", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save homepage content.");
      setNotice("Homepage content saved. The existing images remain the defaults until you replace them.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save homepage content."); }
    finally { setSaving(false); }
  };
  const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]";
  const textAreaClass = "mt-1.5 w-full rounded-lg border border-[#e9e4dc] bg-white p-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]";
  return <>
    <SectionHeading title="Homepage content" description="Manage hero slides, top category cards, and hot deal images without changing the current storefront defaults." action={<Button disabled={saving || loading} onClick={() => void save()}><Check size={14} /> {saving ? "Saving…" : "Save homepage"}</Button>} />
    <div className="mb-4 rounded-lg border border-[#e8dfd2] bg-white p-3 text-[11px] leading-5 text-[#716a60]">The current web images and copy are preloaded. They stay in place until you upload or enter replacement images and save. Uploaded media is stored in Supabase Storage.</div>
    {error && <p role="alert" className="mb-3 rounded-lg bg-[#fbefec] p-3 text-[11px] text-[#9d5548]">{error}{error.includes("not configured") && <span className="block">Configure Supabase, apply migrations, and sign in with an administrator account.</span>}</p>}
    {notice && <p role="status" className="mb-3 rounded-lg bg-[#f1f6ee] p-3 text-[11px] text-[#587052]">{notice}</p>}
    {loading ? <PanelCard className="p-8 text-center text-xs text-[#928a7f]">Loading homepage settings…</PanelCard> : <>
      <div className="space-y-4">
        <div><SectionHeading title="Hero slides" description="Change slide images, copy, and the collection opened by the main button." />{content.heroSlides.map((slide, index) => <PanelCard key={`hero-${index}`} className="mb-3 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#38352f]">Slide {index + 1}</h3><label className="flex items-center gap-2 text-[10px] text-[#716a60]"><input type="checkbox" checked={slide.active} onChange={(event) => updateHero(index, "active", event.target.checked)} /> Show on site</label></div><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><HomepageImageField label="Hero image URL or upload" value={slide.image} onChange={(value) => updateHero(index, "image", value)} /><div className="space-y-3"><label className="block text-[10px] font-medium text-[#716a60]">Eyebrow<input value={slide.eyebrow} onChange={(event) => updateHero(index, "eyebrow", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Headline<textarea rows={2} value={slide.headline} onChange={(event) => updateHero(index, "headline", event.target.value)} className={textAreaClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Supporting text<textarea rows={2} value={slide.subtext} onChange={(event) => updateHero(index, "subtext", event.target.value)} className={textAreaClass} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-medium text-[#716a60]">Button label<input value={slide.ctaLabel} onChange={(event) => updateHero(index, "ctaLabel", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Collection slug<input value={slide.categorySlug} onChange={(event) => updateHero(index, "categorySlug", event.target.value)} className={inputClass} /></label></div><label className="block text-[10px] font-medium text-[#716a60]">Image alt text<input value={slide.alt} onChange={(event) => updateHero(index, "alt", event.target.value)} className={inputClass} /></label></div></div></PanelCard>)}</div>
        <div><SectionHeading title="Top category cards" description="Update category card images, text, alternative text, and collection links." />{content.categories.map((category, index) => <PanelCard key={`category-${index}`} className="mb-3 p-4 sm:p-5"><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><HomepageImageField label={`${category.name} image URL or upload`} value={category.image} onChange={(value) => updateCategory(index, "image", value)} /><div className="grid content-start gap-3 sm:grid-cols-2"><label className="block text-[10px] font-medium text-[#716a60]">Card name<input value={category.name} onChange={(event) => updateCategory(index, "name", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Collection slug<input value={category.slug} onChange={(event) => updateCategory(index, "slug", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Image alt text<input value={category.alt} onChange={(event) => updateCategory(index, "alt", event.target.value)} className={inputClass} /></label><label className="flex items-center gap-2 pt-5 text-[10px] text-[#716a60]"><input type="checkbox" checked={category.active} onChange={(event) => updateCategory(index, "active", event.target.checked)} /> Show category</label></div></div></PanelCard>)}</div>
        <div><SectionHeading title="Hot deal cards" description="Choose the linked product and manage each deal image and displayed campaign details." />{content.hotDeals.map((deal, index) => <PanelCard key={`deal-${index}`} className="mb-3 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#38352f]">Deal {index + 1}</h3><label className="flex items-center gap-2 text-[10px] text-[#716a60]"><input type="checkbox" checked={deal.active} onChange={(event) => updateDeal(index, "active", event.target.checked)} /> Show on site</label></div><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><HomepageImageField label={`${deal.name} image URL or upload`} value={deal.image} onChange={(value) => updateDeal(index, "image", value)} /><div className="grid content-start gap-3 sm:grid-cols-2"><label className="block text-[10px] font-medium text-[#716a60] sm:col-span-2">Linked product<select value={deal.productId} onChange={(event) => updateDeal(index, "productId", event.target.value)} className={inputClass}>{productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="block text-[10px] font-medium text-[#716a60]">Card title<input value={deal.name} onChange={(event) => updateDeal(index, "name", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Category label<input value={deal.category} onChange={(event) => updateDeal(index, "category", event.target.value)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Sale price (BDT)<input type="number" value={deal.price / 100} onChange={(event) => updateDeal(index, "price", Number(event.target.value) * 100)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60]">Original price (BDT)<input type="number" value={deal.was / 100} onChange={(event) => updateDeal(index, "was", Number(event.target.value) * 100)} className={inputClass} /></label><label className="block text-[10px] font-medium text-[#716a60] sm:col-span-2">Image alt text<input value={deal.alt} onChange={(event) => updateDeal(index, "alt", event.target.value)} className={inputClass} /></label></div></div></PanelCard>)}</div>
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
    fetch(`/api/admin/profit?year=${year}`, { cache: "no-store" })
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

function SettingsPage() {
  return <><SectionHeading title="Settings" description="Configure how your store appears and operates." /><div className="grid gap-4 lg:grid-cols-[220px_1fr]"><PanelCard className="h-fit p-2">{["Store profile", "Checkout & delivery", "Payments", "Notifications", "Team access"].map((label, i) => <button key={label} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] ${i === 0 ? "bg-white font-semibold text-[#805e37]" : "text-[#716a60] hover:bg-white"}`}><span>{label}</span>{i === 0 && <ChevronRight className="ml-auto" size={13} />}</button>)}</PanelCard><PanelCard className="p-5 sm:p-6"><h2 className="text-[14px] font-semibold text-[#38352f]">Store profile</h2><p className="mt-1 text-[10px] text-[#9a9388]">These details are shown to customers at checkout and in order emails.</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{[{ label: "Store name", value: "Cloud Lamps & Mirrors" }, { label: "Contact email", value: "hello@cloudlamps.com" }, { label: "Phone", value: "+880 1700-000000" }, { label: "Currency", value: "BDT — Bangladeshi Taka" }].map((field) => <label key={field.label} className="text-[10px] font-medium text-[#716a60]">{field.label}<input defaultValue={field.value} className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]" /></label>)}</div><div className="mt-5 rounded-lg border border-[#eee8de] bg-white p-3 text-[10px] text-[#827b70]"><ShieldCheck className="mr-2 inline text-[#829679]" size={14} />Customer payments and shipping preferences can be configured here.</div><div className="mt-5 flex justify-end"><Button><Check size={14} /> Save changes</Button></div></PanelCard></div></>;
}

function CreateModal({ kind, onClose }: { kind: "product" | "subcategory" | "coupon"; onClose: () => void }) {
  const title = kind === "product" ? "Add a product" : kind === "subcategory" ? "Add a subcategory" : "Create a coupon";
  const [saved, setSaved] = useState(false);
  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-[#28241f]/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-labelledby="admin-modal-title" className="w-full max-w-lg rounded-2xl border border-[#eee6db] bg-white p-6 shadow-[0_22px_70px_rgba(32,28,22,.2)]"><div className="mb-5 flex items-start justify-between"><div><h2 id="admin-modal-title" className="text-[18px] font-semibold text-[#302d27]">{saved ? "Saved for preview" : title}</h2><p className="mt-1 text-[11px] text-[#928a7e]">{saved ? "This visual demo does not persist data yet." : "Fields are shown as a design preview; nothing is sent to the database."}</p></div><button aria-label="Close" onClick={onClose} className="rounded-md p-1.5 text-[#827b70] hover:bg-white"><X size={16} /></button></div>{saved ? <div className="rounded-lg bg-[#f2f6ef] p-4 text-[12px] text-[#587052]"><Check className="mr-2 inline" size={15} />Your entry is ready to connect to Supabase.</div> : <div className="space-y-3">{kind === "subcategory" && <label className="block text-[10px] font-medium text-[#716a60]">Main category<select className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139]"><option>Lamps</option><option>Mirrors</option><option>Tables</option><option>Shades</option></select></label>}{[{ label: kind === "product" ? "Product name" : kind === "subcategory" ? "Subcategory name" : "Coupon code", placeholder: kind === "product" ? "e.g. Luna Opal Pendant" : kind === "subcategory" ? "e.g. Desk Lamps" : "e.g. WELCOME10" }, ...(kind === "product" ? [{ label: "Price (BDT)", placeholder: "0" }, { label: "SKU", placeholder: "CL-0000" }] : kind === "coupon" ? [{ label: "Discount", placeholder: "10% or ৳500" }] : [])].map((field) => <label key={field.label} className="block text-[10px] font-medium text-[#716a60]">{field.label}<input placeholder={field.placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139] outline-none focus:border-[#c9a06a]" /></label>)}{kind === "product" && <label className="block text-[10px] font-medium text-[#716a60]">Department<select className="mt-1.5 h-10 w-full rounded-lg border border-[#e9e4dc] bg-white px-3 text-[11px] text-[#454139]"><option>Lamps</option><option>Mirrors</option><option>Tables</option><option>Shades</option></select></label>}</div>}<div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button>{!saved && <Button onClick={() => setSaved(true)}>Save preview</Button>}</div></div></div>;
}

export default function AdminPanel() {
  const [page, setPage] = useState<PanelKey>("Overview");
  const [globalSearch, setGlobalSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<"product" | "subcategory" | "coupon" | null>(null);
  const pageDescriptions: Record<PanelKey, string> = { Overview: "Store performance at a glance", Orders: "Manage orders and fulfillment", "Custom requests": "Review customer ideas and reference material", Products: "Manage your product catalogue", Categories: "Organize your catalogue", Customers: "Customer directory and activity", Reviews: "Customer product feedback", Coupons: "Discounts and promotions", Rewards: "Customer loyalty programme", "Media library": "Images used in your store", "Homepage content": "Manage hero, category, and hot deal imagery", Analytics: "Store performance and trends", Settings: "Store preferences and team access" };
  const Content = useMemo(() => {
    switch (page) {
      case "Orders": return <OrdersPage />;
      case "Custom requests": return <CustomRequestsPage />;
      case "Products": return <ProductsPage onAdd={() => setModal("product")} />;
      case "Categories": return <CategoriesPage onAdd={() => setModal("subcategory")} />;
      case "Customers": return <CustomersPage />;
      case "Reviews": return <ReviewsPage />;
      case "Coupons": return <CouponsPage onAdd={() => setModal("coupon")} />;
      case "Rewards": return <RewardsPage />;
      case "Media library": return <MediaPage />;
      case "Homepage content": return <HomepageContentPage />;
      case "Analytics": return <AnalyticsPage />;
      case "Settings": return <SettingsPage />;
      default: return <Overview onNavigate={setPage} />;
    }
  }, [page]);
  const renderNav = (group: "Store" | "Engage" | "Manage") => <div className="mb-5"><p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.16em] text-[#a49b8e]">{group}</p><div className="space-y-0.5">{navigation.filter((item) => item.group === group).map(({ label, icon: Icon }) => <button key={label} onClick={() => { setPage(label); setMobileMenu(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] transition ${page === label ? "border-l-2 border-[#bd8547] bg-white font-semibold text-[#805d35] shadow-sm" : "text-[#736c62] hover:bg-white/70 hover:text-[#37342e]"}`}><Icon size={15} strokeWidth={1.8} />{label}{label === "Orders" && <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-[#765a38]">4</span>}</button>)}</div></div>;
  return <div className="min-h-screen bg-white text-[#282722] [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
    {mobileMenu && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileMenu(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[238px] flex-col border-r border-[#ece6dd] bg-white px-3 transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}><div className="flex h-[68px] items-center gap-3 border-b border-[#eee8df] px-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#252723] text-[#d6b17a]"><span className="font-serif text-[16px]">C</span></div><div><p className="text-[12px] font-semibold tracking-[.04em] text-[#312e28]">CLOUD LAMPS</p><p className="mt-0.5 text-[8px] font-medium uppercase tracking-[.2em] text-[#9b7547]">Store studio</p></div><span className="ml-auto rounded-md border border-[#e9e2d7] px-1.5 py-1 text-[8px] uppercase tracking-wider text-[#827b70]">Admin</span></div><nav className="min-h-0 flex-1 overflow-y-auto px-1 pt-5">{renderNav("Store")}{renderNav("Engage")}{renderNav("Manage")}</nav><div className="border-t border-[#eee8df] px-2 py-3"><div className="flex items-center gap-2.5 rounded-lg p-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#775832]">AD</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#49443c]">Store administrator</p><p className="truncate text-[9px] text-[#a09a90]">admin@cloudlamps.com</p></div><Ellipsis size={15} className="text-[#938b7f]" /></div></div></aside>
    <div className="min-h-screen lg:pl-[238px]"><header className="sticky top-0 z-20 flex h-[62px] items-center gap-4 border-b border-[#ece6dd] bg-white/95 px-4 backdrop-blur sm:px-7"><button aria-label="Open navigation" onClick={() => setMobileMenu(true)} className="rounded-md p-2 text-[#716a60] hover:bg-white lg:hidden"><Menu size={18} /></button><div className="hidden items-center gap-2 text-[10px] text-[#a19a90] sm:flex"><span>Store</span><ChevronRight size={12} /><span className="font-medium text-[#4b463e]">{page}</span></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><label className="hidden h-9 w-[230px] items-center gap-2 rounded-lg border border-[#e9e4dc] bg-white px-2.5 text-[#9a9388] md:flex"><Search size={14} /><input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Search anything…" className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#aaa399]" /><kbd className="rounded border border-[#e9e4dc] px-1 py-0.5 text-[8px]">⌘ K</kbd></label><button aria-label="Notifications" className="relative rounded-lg p-2 text-[#777168] hover:bg-white"><Bell size={16} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#bd8547]" /></button><div className="hidden h-6 border-l border-[#e9e4dc] sm:block" /><button className="flex items-center gap-2 rounded-lg p-1 hover:bg-white"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-[#775832]">AD</span><ChevronDown size={12} className="text-[#827b70]" /></button></div></header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8"><div className="mb-6 flex items-center justify-between"><div><p className="text-[9px] font-medium uppercase tracking-[.16em] text-[#a77b47]">Cloud Lamps &amp; Mirrors <span className="px-1.5 text-[#c7b9a4]">/</span> Admin</p><p className="mt-1 text-[10px] text-[#aaa297]">{pageDescriptions[page]}</p></div><div className="hidden items-center gap-2 text-[9px] text-[#9a9388] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#9aaf8c]" />Preview with live inboxes</div></div>{globalSearch && <div className="mb-4 rounded-lg border border-[#e8dfd2] bg-white px-4 py-2.5 text-[10px] text-[#716a60]">Search preview: “{globalSearch}” · Use the search field inside a section to filter its records.</div>}{Content}<footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-[#ece6dd] pt-4 text-[9px] text-[#aaa297]"><span>Cloud Lamps &amp; Mirrors · Store admin preview</span><span className="flex items-center gap-1"><CircleHelp size={11} /> Review moderation requires Supabase setup</span></footer></main></div>
    {modal && <CreateModal kind={modal} onClose={() => setModal(null)} />}
  </div>;
}
