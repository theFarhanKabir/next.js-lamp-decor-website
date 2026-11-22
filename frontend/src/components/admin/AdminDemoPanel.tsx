"use client";

import { useState } from "react";
import {
  Activity, BarChart3, Bell, Boxes, ChevronDown, ChevronRight,
  ClipboardList, CreditCard, Gift, LayoutDashboard, Menu, MessageSquareText,
  Package, Search, Settings2, ShieldCheck, ShoppingBag, Tag, Users,
  type LucideIcon,
} from "lucide-react";

type DemoSection = "Overview" | "Orders" | "Products" | "Customers" | "Categories" | "Coupons" | "Reviews" | "Settings";

const menu: { label: DemoSection; icon: LucideIcon; group: string }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "Store" },
  { label: "Orders", icon: ShoppingBag, group: "Store" },
  { label: "Products", icon: Package, group: "Store" },
  { label: "Categories", icon: Tag, group: "Store" },
  { label: "Customers", icon: Users, group: "Engage" },
  { label: "Reviews", icon: MessageSquareText, group: "Engage" },
  { label: "Coupons", icon: Gift, group: "Manage" },
  { label: "Settings", icon: Settings2, group: "Manage" },
];

const orders = [
  { id: "CLM-2048", name: "Nadia Rahman", item: "Luna Table Lamp", amount: "৳ 8,900", status: "Processing" },
  { id: "CLM-2047", name: "Tanvir Ahmed", item: "Arc Floor Lamp", amount: "৳ 18,500", status: "Confirmed" },
  { id: "CLM-2046", name: "Samira Khan", item: "Halo Wall Mirror", amount: "৳ 12,200", status: "Delivered" },
  { id: "CLM-2045", name: "Rafiul Islam", item: "Dune Pendant Light", amount: "৳ 9,750", status: "Pending" },
];

const products = [
  { name: "Luna Table Lamp", sku: "LMP-001", category: "Lamps", price: "৳ 8,900", stock: "12", status: "Active" },
  { name: "Halo Wall Mirror", sku: "MIR-014", category: "Mirrors", price: "৳ 12,200", stock: "8", status: "Active" },
  { name: "Arc Floor Lamp", sku: "LMP-008", category: "Lamps", price: "৳ 18,500", stock: "4", status: "Low stock" },
  { name: "Dune Pendant Light", sku: "LMP-021", category: "Lights", price: "৳ 9,750", stock: "16", status: "Active" },
];

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return <article className="rounded-xl border border-[#eee9e1] bg-white p-5"><div className="flex items-center justify-between"><span className="text-[11px] text-[#79746c]">{label}</span><Icon size={17} className="text-[#a77b47]" /></div><p className="mt-4 text-[25px] font-semibold tracking-tight text-[#25241f]">{value}</p><p className="mt-1 text-[10px] text-[#89837a]">{detail}</p></article>;
}

function Status({ children }: { children: string }) {
  const color = children === "Delivered" || children === "Active" ? "bg-[#edf4eb] text-[#58744f]" : children === "Pending" || children === "Low stock" ? "bg-[#fff4df] text-[#95713d]" : "bg-[#f1f0ed] text-[#656158]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-medium ${color}`}>{children}</span>;
}

export default function AdminDemoPanel() {
  const [section, setSection] = useState<DemoSection>("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const groups = ["Store", "Engage", "Manage"];

  return <div className="min-h-screen bg-[#f7f7f5] text-[#25241f] [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
    {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[238px] flex-col border-r border-[#ece7df] bg-white px-3 transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-[68px] items-center gap-3 border-b border-[#eee8df] px-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#252723] font-serif text-base text-[#d6b17a]">C</div><div><p className="text-[12px] font-semibold tracking-[.04em]">CLOUD LAMPS</p><p className="mt-0.5 text-[8px] uppercase tracking-[.2em] text-[#9b7547]">Store studio</p></div></div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-1 pt-5">{groups.map((group) => <div key={group} className="mb-5"><p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.16em] text-[#858078]">{group}</p><div className="space-y-0.5">{menu.filter((item) => item.group === group).map(({ label, icon: Icon }) => <button key={label} onClick={() => { setSection(label); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] transition ${section === label ? "bg-[#171717] font-semibold text-white" : "text-[#55534d] hover:bg-[#f5f3ef]"}`}><Icon size={15} />{label}</button>)}</div></div>)}</nav>
      <div className="border-t border-[#eee8df] px-2 py-3"><div className="flex items-center gap-2.5 rounded-lg p-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3eee5] text-[10px] font-semibold text-[#775832]">DP</div><div><p className="text-[10px] font-semibold">Demo preview</p><p className="text-[9px] text-[#a09a90]">Sample data only</p></div></div></div>
    </aside>
    <div className="min-h-screen lg:pl-[238px]">
      <header className="sticky top-0 z-20 flex h-[62px] items-center gap-4 border-b border-[#ece7df] bg-white/95 px-4 backdrop-blur sm:px-7"><button aria-label="Open navigation" onClick={() => setMenuOpen(true)} className="rounded-md p-2 text-[#716a60] hover:bg-[#f5f3ef] lg:hidden"><Menu size={18} /></button><div className="hidden items-center gap-2 text-[10px] text-[#a19a90] sm:flex"><span>Store</span><ChevronRight size={12} /><span className="font-medium text-[#4b463e]">{section}</span></div><div className="ml-auto flex items-center gap-3"><span className="hidden rounded-full border border-[#eadfcf] bg-[#faf6ef] px-3 py-1.5 text-[9px] font-medium text-[#8d6437] sm:inline-flex">READ ONLY DEMO</span><button aria-label="Notifications" className="rounded-lg p-2 text-[#777168]"><Bell size={16} /></button><div className="flex items-center gap-1 text-[10px] text-[#746e65]">Preview <ChevronDown size={12} /></div></div></header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] font-medium uppercase tracking-[.16em] text-[#a77b47]">Cloud Lamps &amp; Mirrors <span className="px-1.5 text-[#c7b9a4]">/</span> Admin preview</p><h1 className="mt-2 text-[23px] font-semibold tracking-tight">{section}</h1><p className="mt-1 text-[10px] text-[#918b81]">{section === "Overview" ? "A sample look at your store workspace" : `Sample ${section.toLowerCase()} workspace`}</p></div><span className="rounded-lg border border-[#eadfcf] bg-white px-3 py-2 text-[9px] text-[#8d6437]">Demo data · changes are disabled</span></div>
        {section === "Overview" && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Sales this month" value="৳ 284,650" detail="↑ 12.8% from last month" icon={BarChart3} /><Metric label="All orders" value="148" detail="Across all order statuses" icon={ShoppingBag} /><Metric label="Pending orders" value="9" detail="Awaiting an update" icon={Activity} /><Metric label="Active products" value="42" detail="Across 4 departments" icon={Boxes} /></div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]"><section className="rounded-xl border border-[#eee9e1] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-[12px] font-semibold">Sales overview</h2><p className="mt-1 text-[9px] text-[#918b81]">Monthly revenue · sample figures</p></div><span className="rounded-md border border-[#eee9e1] px-2.5 py-1.5 text-[9px] text-[#777168]">This year</span></div><div className="mt-7 flex h-40 items-end gap-3 border-b border-l border-[#eee9e1] px-3">{[38, 54, 45, 68, 58, 78, 63, 90, 72, 84, 66, 100].map((height, index) => <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t bg-[#c4a477]" style={{ height: `${height}%` }} /><span className="pb-[-1px] text-[8px] text-[#aaa399]">{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][index]}</span></div>)}</div></section><section className="rounded-xl border border-[#eee9e1] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-[12px] font-semibold">Quick summary</h2><p className="mt-1 text-[9px] text-[#918b81]">Store activity at a glance</p></div><ShieldCheck size={17} className="text-[#a77b47]" /></div><div className="mt-5 space-y-4">{[["Orders to fulfill", "9", "text-[#8d6437]"], ["Custom requests", "4", "text-[#655d52]"], ["Low stock products", "3", "text-[#a25e48]"], ["New reviews", "7", "text-[#58744f]"]].map(([label, value, color]) => <div key={label} className="flex items-center justify-between border-b border-[#f1eee9] pb-3 last:border-0"><span className="text-[10px] text-[#716a60]">{label}</span><span className={`text-[12px] font-semibold ${color}`}>{value}</span></div>)}</div></section></div>
          <section className="mt-4 overflow-hidden rounded-xl border border-[#eee9e1] bg-white"><div className="flex items-center justify-between border-b border-[#f0ece6] px-5 py-4"><div><h2 className="text-[12px] font-semibold">Recent orders</h2><p className="mt-1 text-[9px] text-[#918b81]">Fictional entries for presentation</p></div><ClipboardList size={17} className="text-[#9a9388]" /></div><OrdersTable /></section>
        </>}
        {section === "Orders" && <section className="overflow-hidden rounded-xl border border-[#eee9e1] bg-white"><div className="border-b border-[#f0ece6] p-4"><SearchField label="Search sample orders" /></div><OrdersTable /></section>}
        {section === "Products" && <section className="overflow-hidden rounded-xl border border-[#eee9e1] bg-white"><div className="border-b border-[#f0ece6] p-4"><SearchField label="Search sample products" /></div><ProductsTable /></section>}
        {section === "Customers" && <section className="rounded-xl border border-[#eee9e1] bg-white p-6"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Sample customers" value="1,284" detail="Demo figure" icon={Users} /><Metric label="Repeat customers" value="36%" detail="Demo figure" icon={CreditCard} /><Metric label="New this month" value="84" detail="Demo figure" icon={Activity} /></div><p className="mt-5 text-[10px] leading-5 text-[#837d73]">Customer names and details are not shown in this preview.</p></section>}
        {section === "Categories" && <DemoList title="Sample categories" items={["Lamps · 18 products", "Mirrors · 12 products", "Tables · 7 products", "Shades · 5 products"]} icon={Tag} />}
        {section === "Coupons" && <DemoList title="Sample promotions" items={["WELCOME10 · 10% off · Active", "HOME500 · ৳ 500 off · Active", "LIGHTS15 · 15% off · Scheduled"]} icon={Gift} />}
        {section === "Reviews" && <DemoList title="Review moderation preview" items={["Warm light, beautiful finish · 5 stars", "Looks lovely in our hallway · 4 stars", "Exactly as pictured · 5 stars"]} icon={MessageSquareText} />}
        {section === "Settings" && <DemoList title="Store settings preview" items={["Store profile", "Delivery preferences", "Homepage content", "Admin workspace"]} icon={Settings2} />}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[#ece7df] pt-4 text-[9px] text-[#aaa297]"><span>Cloud Lamps &amp; Mirrors · Admin preview</span><span>Fictional sample data · No Supabase or backend connection</span></footer>
      </main>
    </div>
  </div>;
}

function SearchField({ label }: { label: string }) {
  return <div className="flex h-9 max-w-sm items-center gap-2 rounded-lg border border-[#e9e4dc] px-3 text-[#9a9388]"><Search size={14} /><span className="text-[10px]">{label}</span></div>;
}

function OrdersTable() {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-[#fcfbf9] text-[8px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Order", "Customer", "Item", "Total", "Status"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-[#f3f0ea] text-[10px]"><td className="px-5 py-3.5 font-semibold">{order.id}</td><td className="px-5 py-3.5">{order.name}</td><td className="px-5 py-3.5 text-[#716a60]">{order.item}</td><td className="px-5 py-3.5">{order.amount}</td><td className="px-5 py-3.5"><Status>{order.status}</Status></td></tr>)}</tbody></table></div>;
}

function ProductsTable() {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="bg-[#fcfbf9] text-[8px] uppercase tracking-[.1em] text-[#948c80]"><tr>{["Product", "Category", "Price", "Stock", "Status"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{products.map((product) => <tr key={product.sku} className="border-t border-[#f3f0ea] text-[10px]"><td className="px-5 py-3.5"><span className="font-semibold">{product.name}</span><span className="ml-2 text-[9px] text-[#9c958a]">{product.sku}</span></td><td className="px-5 py-3.5">{product.category}</td><td className="px-5 py-3.5">{product.price}</td><td className="px-5 py-3.5">{product.stock} units</td><td className="px-5 py-3.5"><Status>{product.status}</Status></td></tr>)}</tbody></table></div>;
}

function DemoList({ title, items, icon: Icon }: { title: string; items: string[]; icon: LucideIcon }) {
  return <section className="rounded-xl border border-[#eee9e1] bg-white"><div className="flex items-center gap-3 border-b border-[#f0ece6] px-5 py-4"><Icon size={17} className="text-[#a77b47]" /><h2 className="text-[12px] font-semibold">{title}</h2></div><div className="divide-y divide-[#f3f0ea]">{items.map((item) => <div key={item} className="px-5 py-4 text-[10px] text-[#5f5a51]">{item}</div>)}</div></section>;
}
