"use client";
import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient as createSupabaseBrowserClient } from "../lib/supabase/client";
import {
  ShoppingBag, ShoppingCart, Heart, Home, Search, User, X, Menu,
  ChevronRight, ChevronLeft, ChevronDown, Star, Minus, Plus,
  ArrowRight, ArrowLeft, Check, Package, Truck, Shield, Award, Share2,
  SlidersHorizontal, RotateCcw, Filter, Sliders, CheckSquare, Square
} from "lucide-react";
import { PRODUCTS, type Product } from "./catalog";
import { DEFAULT_HOMEPAGE_CONTENT, type HomepageContent } from "./homepage-content";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────


interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedFabric?: string;
  selectedLeg?: string;
  price: number;
}

interface ToastItem {
  id: string;
  product: Product;
  variant: string;
}

type Page = { name: string; params?: Record<string, string> };

interface AppCtx {
  products: Product[];
  homepageContent: HomepageContent;
  cart: CartItem[];
  wishlist: string[];
  miniCartOpen: boolean;
  searchOpen: boolean;
  toasts: ToastItem[];
  user: SupabaseUser | null;
  authReady: boolean;
  currentPage: Page;
  navigate: (name: string, params?: Record<string, string>) => void;
  goBack: () => void;
  addToCart: (product: Product, opts?: { size?: string; color?: string; fabric?: string; legFinish?: string; quantity?: number; price?: number }) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  toggleWishlist: (id: string) => void;
  signOut: () => Promise<void>;
  openMiniCart: () => void;
  closeMiniCart: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  dismissToast: (id: string) => void;
  cartCount: number;
  cartSubtotal: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRELOADER & REVEAL ANIMATION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_IMG = "https://images.unsplash.com/photo-1775667693473-91e07000bb1a?auto=format&fit=crop&w=800&q=80";

function handleImgError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = FALLBACK_IMG;
}

function Preloader({ onComplete }: { onComplete: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(onComplete, 600);
    }, 1300);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#1A1815] text-[#FFFFFF] flex flex-col items-center justify-center transition-opacity duration-700 ease-out ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Brand Monogram */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border border-[#A67C3D]/40 animate-ping absolute inset-0 opacity-30" />
        <div className="w-16 h-16 rounded-full border border-[#A67C3D] flex items-center justify-center bg-[#1A1815] shadow-2xl">
          <span className="text-[26px] font-light text-[#EDE3D0]" style={{ fontFamily: "'Fraunces', serif" }}>
            M
          </span>
        </div>
      </div>

      <h1
        className="text-[28px] md:text-[34px] font-light tracking-[0.3em] uppercase text-[#FFFFFF] mb-2 text-center"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Cloud Lamps & Mirrors
      </h1>
      <p className="text-[10px] md:text-[11px] font-medium tracking-[0.35em] uppercase text-[#A67C3D] mb-8 text-center">
        Lighting, Mirrors, Shades & Tables
      </p>

      {/* Progress Bar */}
      <div className="w-44 h-[2px] bg-[#3A3530] rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-[#A67C3D] via-[#C9A362] to-[#EDE3D0] rounded-full transition-all duration-1000 ease-out"
          style={{ width: fading ? "100%" : "85%" }}
        />
      </div>
    </div>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const getTransform = () => {
    if (!visible) {
      if (direction === "up") return "translateY(32px)";
      if (direction === "down") return "translateY(-32px)";
      if (direction === "left") return "translateX(32px)";
      if (direction === "right") return "translateX(-32px)";
      return "scale(0.97)";
    }
    return "translateY(0) translateX(0) scale(1)";
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: getTransform(),
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const HERO_SLIDES = [
  {
    image: U("photo-1721824296808-92c325601dd8", 1800),
    eyebrow: "THE SHADE EDIT",
    headline: "Quiet forms.\nBeautifully reflected.",
    subtext: "Thoughtful lighting and mirror details for a more balanced home.",
  },
  {
    image: U("photo-1540759772348-12e90305e8f4", 1800),
    eyebrow: "MIRRORS THAT OPEN A ROOM",
    headline: "Let the light\nfind its way in.",
    subtext: "Reflective forms and finely finished frames for everyday spaces.",
  },
  {
    image: U("photo-1716593145277-36e92b658bfe", 1800),
    eyebrow: "LIGHT, LAYERED",
    headline: "A softer light\nfor quieter rooms.",
    subtext: "Sculptural lamps and considered mirrors in calm, cool tones.",
  },
];

const CATEGORIES = [
  { name: "Lamps", count: PRODUCTS.filter((p) => p.category === "Lighting").length, image: U("photo-1778880707611-d1f09e32b4e2", 600), slug: "lighting" },
  { name: "Mirrors", count: PRODUCTS.filter((p) => p.category === "Mirrors").length, image: U("photo-1542485028-6e019f9c8a8e", 600), slug: "mirrors" },
  { name: "Tables", count: PRODUCTS.filter((p) => p.subcategory.toLowerCase().includes("table")).length, image: U("photo-1784651859128-b04c1d4732f3", 600), slug: "tables" },
  { name: "Shades", count: PRODUCTS.filter((p) => p.category === "Shades").length, image: U("photo-1774444052266-2e4b58d85c3b", 600), slug: "shades" },
  { name: "New Arrivals", count: PRODUCTS.filter((p) => p.badge === "new").length, image: U("photo-1775667693473-91e07000bb1a", 600), slug: "new" },
  { name: "Sale", count: PRODUCTS.filter((p) => p.salePrice).length, image: U("photo-1542485028-6e019f9c8a8e", 600), slug: "sale" },
];

const NAV_ITEMS: { label: string; slug: string; hasMega: boolean; page?: string }[] = [
  { label: "COLLECTIONS", slug: "all", hasMega: false },
  { label: "LAMPS", slug: "lighting", hasMega: true },
  { label: "MIRRORS", slug: "mirrors", hasMega: true },
  { label: "TABLES", slug: "tables", hasMega: true },
  { label: "SHADES", slug: "shades", hasMega: true },
  { label: "CUSTOMIZE", slug: "all", page: "custom-request", hasMega: false },
];

//

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(p: number): string {
  return "৳" + (p / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function resolvePrice(product: Product, size?: string, fabric?: string): number {
  let price = product.salePrice ?? product.basePrice;
  if (size && product.sizes) {
    const s = product.sizes.find((x) => x.label === size);
    if (s) price += s.delta;
  }
  if (fabric && product.fabrics) {
    const f = product.fabrics.find((x) => x.label === fabric);
    if (f) price += f.delta;
  }
  return price;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const AppContext = createContext<AppCtx>(null!);
function useApp() {
  return useContext(AppContext);
}

function pageFromPathname(pathname: string): Page {
  const segments = pathname.split("/").filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });

  if (segments.length === 0) return { name: "home" };
  if (segments[0] === "collections") {
    return { name: "listing", params: { category: segments[1] || "all" } };
  }
  if (segments[0] === "products") {
    return segments[1]
      ? { name: "product", params: { id: segments[1] } }
      : { name: "listing", params: { category: "all" } };
  }
  if (["cart", "wishlist", "checkout"].includes(segments[0])) {
    return { name: segments[0] };
  }
  if (["account", "login", "register", "forgot-password", "reset-password"].includes(segments[0])) {
    return { name: segments[0] };
  }
  if (segments[0] === "custom-request") return { name: "custom-request" };

  return { name: "not-found" };
}

function routeForPage(name: string, params?: Record<string, string>) {
  switch (name) {
    case "home":
      return "/";
    case "listing": {
      const category = params?.category?.trim();
      return !category || category.toLowerCase() === "all"
        ? "/collections"
        : `/collections/${encodeURIComponent(category.toLowerCase().replace(/\s+/g, "-"))}`;
    }
    case "product":
      return params?.id ? `/products/${encodeURIComponent(params.id)}` : "/collections";
    case "cart":
    case "wishlist":
    case "checkout":
    case "account":
    case "login":
    case "register":
    case "forgot-password":
    case "reset-password":
      return `/${name}`;
    case "custom-request":
      return "/custom-request";
    default:
      return "/";
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const currentPage = pageFromPathname(pathname || "/");
  const finishLoading = useCallback(() => setLoading(false), []);

  useEffect(() => {
    let active = true;
    fetch("/api/catalog", { cache: "no-store" }).then((response) => response.json()).then((result) => {
      if (active && Array.isArray(result.products)) setProducts(result.products);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/homepage-content", { cache: "no-store" }).then((response) => response.json()).then((result) => {
      if (active && result.content?.heroSlides && result.content?.categories && result.content?.hotDeals) setHomepageContent(result.content);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setAuthReady(true);
    }).catch(() => {
      if (active) setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const navigate = useCallback((name: string, params?: Record<string, string>) => {
    router.push(routeForPage(name, params), { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  const goBack = useCallback(() => {
    router.back();
  }, [router]);
  const addToCart = useCallback((product: Product, opts?: { size?: string; color?: string; fabric?: string; legFinish?: string; quantity?: number; price?: number }) => {
    const quantity = Math.max(1, Math.floor(opts?.quantity ?? 1));
    const legDelta = opts?.legFinish && product.legs ? (product.legs.find((leg) => leg.label === opts.legFinish)?.delta ?? 0) : 0;
    const price = opts?.price ?? resolvePrice(product, opts?.size, opts?.fabric) + legDelta;
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.product.id === product.id && i.selectedColor === opts?.color && i.selectedSize === opts?.size && i.selectedFabric === opts?.fabric && i.selectedLeg === opts?.legFinish
      );
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { id: uid(), product, quantity, selectedSize: opts?.size, selectedColor: opts?.color, selectedFabric: opts?.fabric, selectedLeg: opts?.legFinish, price }];
    });
    const variant = [opts?.size, opts?.color, opts?.fabric, opts?.legFinish].filter(Boolean).join(" · ");
    setToasts((prev) => [...prev, { id: uid(), product, variant }]);
    setMiniCartOpen(true);
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.id !== id));
    else setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
  }, []);

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Account sign-in is not configured yet.");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <AppContext.Provider value={{
        products, homepageContent, cart, wishlist, miniCartOpen, searchOpen, toasts, currentPage,
        navigate, goBack, addToCart, removeFromCart, updateQty, toggleWishlist,
        openMiniCart: () => setMiniCartOpen(true),
        closeMiniCart: () => setMiniCartOpen(false),
        openSearch: () => setSearchOpen(true),
        closeSearch: () => setSearchOpen(false),
        dismissToast, cartCount, cartSubtotal, user, authReady, signOut,
      }}>
      {loading && <Preloader onComplete={finishLoading} />}
      {children}
    </AppContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function BadgeTag({ type }: { type: Product["badge"] }) {
  if (!type) return null;
  const cfg = {
    new: { label: "NEW IN", bg: "#1A1815", color: "#FFFFFF" },
    sale: { label: "SALE", bg: "#F4E2DB", color: "#B4593F" },
    "pre-order": { label: "PRE-ORDER", bg: "#F1E6CF", color: "#B07C2E" },
    "sold-out": { label: "SOLD OUT", bg: "#FFFFFF", color: "#8A8377" },
  }[type];
  return (
    <span
      className="text-[10px] font-medium tracking-widest uppercase px-2 py-1 rounded-[4px]"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i} size={11}
          className={i <= Math.round(value) ? "fill-[#A67C3D] text-[#A67C3D]" : "text-[#DBD5C7]"}
        />
      ))}
    </span>
  );
}

type CustomerReview = {
  id: string;
  product_slug: string;
  customer_name: string;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
  status?: "pending" | "published" | "hidden";
};

function CustomerReviews({
  product, reviews, loading, error, user, authReady, navigate,
}: {
  product: Product;
  reviews: CustomerReview[];
  loading: boolean;
  error: string;
  user: SupabaseUser | null;
  authReady: boolean;
  navigate: (name: string, params?: Record<string, string>) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const distribution = [5, 4, 3, 2, 1].map((score) => ({
    score,
    count: reviews.filter((review) => review.rating === score).length,
  }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug: product.id, rating, title, body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your review could not be submitted.");
      setNotice(result.message || "Thanks — your review is awaiting approval.");
      setTitle("");
      setBody("");
      setRating(5);
      setFormOpen(false);
    } catch (submitError) {
      setNotice(submitError instanceof Error ? submitError.message : "Your review could not be submitted.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section id="customer-reviews" className="mt-16 border-t border-[#DBD5C7] pt-10 sm:mt-20 sm:pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#A67C3D]">From our customers</p>
          <h2 className="font-serif text-[26px] leading-tight text-[#1A1815] sm:text-[30px]">Customer Reviews</h2>
          <p className="mt-2 text-[13px] text-[#8A8377]">Thoughts on {product.name}</p>
        </div>
        {user ? (
          <button type="button" onClick={() => { setFormOpen((open) => !open); setNotice(""); }} className="rounded border border-[#1A1815] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#1A1815] transition hover:bg-[#1A1815] hover:text-white">{formOpen ? "Close review form" : "Write a review"}</button>
        ) : (
          <button type="button" disabled={!authReady} onClick={() => navigate("login")} className="rounded border border-[#1A1815] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#1A1815] transition hover:bg-[#1A1815] hover:text-white disabled:opacity-50">{authReady ? "Sign in to review" : "Checking account…"}</button>
        )}
      </div>

      {(notice || error) && <p role={notice.includes("awaiting approval") ? "status" : "alert"} className={`mb-5 rounded border px-4 py-3 text-[12px] ${notice.includes("awaiting approval") ? "border-[#dce5d7] bg-[#f4f7f1] text-[#53694b]" : "border-[#ead8cf] bg-[#fbf4f0] text-[#9b5544]"}`}>{notice || error}</p>}

      {formOpen && user && <form onSubmit={submit} className="mb-8 rounded-lg border border-[#DBD5C7] bg-white p-5 sm:p-7">
        <h3 className="font-serif text-[20px] text-[#1A1815]">Share your experience</h3>
        <p className="mt-1 text-[12px] leading-5 text-[#8A8377]">Your review will appear here after our team approves it.</p>
        <fieldset className="mt-5"><legend className="mb-2 text-[11px] font-medium text-[#4A463F]">Your rating</legend><div className="flex gap-1" role="radiogroup" aria-label="Choose a star rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)} className={`text-2xl transition-colors ${value <= rating ? "text-[#B88A45]" : "text-[#D8D2C8]"}`}>★</button>)}</div></fieldset>
        <label className="mt-4 block text-[11px] font-medium text-[#4A463F]">Review title <span className="font-normal text-[#8A8377]">(optional)</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Sum up your experience" className="mt-2 h-11 w-full rounded border border-[#DBD5C7] px-3 text-[13px] outline-none focus:border-[#A67C3D]" /></label>
        <label className="mt-4 block text-[11px] font-medium text-[#4A463F]">Your review<textarea required minLength={10} maxLength={3000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="What did you think of this piece?" rows={5} className="mt-2 w-full resize-y rounded border border-[#DBD5C7] px-3 py-3 text-[13px] leading-5 outline-none focus:border-[#A67C3D]" /><span className="mt-1 block text-right text-[10px] text-[#8A8377]">{body.length} / 3000</span></label>
        <button disabled={pending} type="submit" className="mt-4 rounded bg-[#1A1815] px-6 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white transition hover:bg-[#39342D] disabled:cursor-wait disabled:opacity-60">{pending ? "Submitting…" : "Submit for approval"}</button>
      </form>}

      <div className="grid gap-9 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        <div className="border-b border-[#DBD5C7] pb-7 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-9">
          <div className="flex items-end gap-3"><span className="font-serif text-[54px] leading-none text-[#1A1815]">{reviews.length ? average.toFixed(1) : "—"}</span><div className="pb-1"><Stars value={average} /><p className="mt-1 text-[11px] text-[#8A8377]">{reviews.length} approved {reviews.length === 1 ? "review" : "reviews"}</p></div></div>
          <div className="mt-6 space-y-2.5">{distribution.map(({ score, count }) => <div key={score} className="flex items-center gap-2 text-[10px] text-[#8A8377]"><span className="w-5 shrink-0">{score}★</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EAE5DC]"><div className="h-full rounded-full bg-[#B88A45]" style={{ width: `${reviews.length ? count / reviews.length * 100 : 0}%` }} /></div><span className="w-5 text-right">{count}</span></div>)}</div>
        </div>
        <div className="divide-y divide-[#DBD5C7]">
          {loading ? <p className="py-5 text-[13px] text-[#8A8377]">Loading approved reviews…</p> : reviews.length ? reviews.map((review) => <article key={review.id} className="py-5 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><Stars value={review.rating} /><h3 className="mt-2 text-[14px] font-semibold text-[#1A1815]">{review.title || "Customer review"}</h3></div><time className="text-[11px] text-[#8A8377]">{new Date(review.created_at).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })}</time></div><p className="mt-2 text-[13px] leading-6 text-[#4A463F]">{review.body}</p><p className="mt-3 text-[11px] font-medium text-[#6F7D5E]">{review.customer_name}</p></article>) : <div className="py-5"><p className="text-[14px] font-medium text-[#4A463F]">No approved reviews yet</p><p className="mt-1 text-[12px] leading-5 text-[#8A8377]">Be the first to share your experience with {product.name}.</p></div>}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CARD
// ─────────────────────────────────────────────────────────────────────────────

function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addToCart, closeMiniCart, toggleWishlist, wishlist, navigate } = useApp();
  const [hovered, setHovered] = useState(false);
  const [swatchIdx, setSwatchIdx] = useState(0);
  const isWished = wishlist.includes(product.id);
  const displayPrice = product.salePrice ?? product.basePrice;

  return (
    <Reveal delay={(index % 4) * 70}>
      <div
        className="group cursor-pointer"
        onClick={() => navigate("product", { id: product.id })}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
        }}
      >
        {/* Image block — 4:5 */}
        <div
          className="relative overflow-hidden mb-4 transition-all duration-300"
          style={{
            aspectRatio: "4/5",
            borderRadius: 8,
            backgroundColor: "#FFFFFF",
            boxShadow: hovered ? "0 12px 32px -12px rgba(26,24,21,0.18)" : "none",
            transform: hovered ? "translateY(-4px)" : "none",
          }}
        >
          <img
            src={product.images.silo}
            alt={product.name}
            onError={handleImgError}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: hovered ? 0 : 1, transform: "scale(1.12)" }}
          />
          <img
            src={product.images.lifestyle}
            alt=""
            onError={handleImgError}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            style={{ opacity: hovered ? 1 : 0, transform: hovered ? "scale(1.12)" : "scale(1.08)" }}
          />

          {product.badge && (
            <div className="absolute top-3 left-3 z-10">
              <BadgeTag type={product.badge} />
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
            aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-sm transition-transform duration-200 hover:scale-110"
          >
            <Heart size={15} className={isWished ? "fill-[#B4593F] text-[#B4593F]" : "text-[#4A463F]"} />
          </button>

          {/* Action row */}
          <div
            className="absolute inset-x-0 bottom-0 z-10 transition-transform duration-300 ease-out"
            style={{ transform: hovered ? "translateY(0)" : "translateY(100%)" }}
          >
            <div className="bg-gradient-to-t from-black/45 to-transparent pt-8 pb-3 px-3">
              <div className="flex flex-col gap-2">
                <div className="flex gap-1.5">
                  {product.swatches.slice(0, 4).map((sw, i) => (
                    <button
                      key={sw.label}
                      onClick={(e) => { e.stopPropagation(); setSwatchIdx(i); }}
                      aria-label={`Colour: ${sw.label}`}
                      className="rounded-full border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      style={{
                        width: 17, height: 17, backgroundColor: sw.color,
                        borderColor: swatchIdx === i ? "#fff" : "rgba(255,255,255,0.35)",
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); addToCart(product, { color: product.swatches[swatchIdx]?.label }); }}
                    className="flex-1 rounded-full bg-white/90 px-2 py-2 text-[9px] font-medium text-[#1A1815] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Add to Cart
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(product, { color: product.swatches[swatchIdx]?.label });
                      closeMiniCart();
                      navigate("checkout");
                    }}
                    className="flex-1 rounded-full bg-[#1A1815] px-2 py-2 text-[9px] font-medium text-white transition-colors hover:bg-[#3A3530] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <p className="text-[10px] font-medium tracking-widest uppercase text-[#8A8377] mb-1">{product.subcategory}</p>
        <h4
          className="text-[14px] font-semibold text-[#1A1815] mb-1 leading-snug"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {product.name}
        </h4>
        {product.rating && (
          <div className="flex items-center gap-1.5 mb-2">
            <Stars value={product.rating} />
            <span className="text-[11px] text-[#8A8377]">{product.rating} ({product.reviewCount})</span>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-medium text-[#1A1815]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatPrice(displayPrice)}
          </span>
          {product.salePrice && (
            <span className="text-[12px] text-[#8A8377] line-through" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatPrice(product.basePrice)}
            </span>
          )}
        </div>
      </div>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEGA MENU
// ─────────────────────────────────────────────────────────────────────────────

const MEGA_DATA: Record<string, { links: string[] }> = {
  LAMPS: { links: ["Table Lamps", "Floor Lamps", "Pendant Lights", "Wall Lights", "Desk Lamps"] },
  MIRRORS: { links: ["Round Mirrors", "Arched Mirrors", "Full-Length Mirrors", "Vanity Mirrors", "Decorative Mirrors"] },
  TABLES: { links: ["Console Tables", "Side Tables", "Coffee Tables", "Bedside Tables", "Nesting Tables"] },
  SHADES: { links: ["Linen Shades", "Pleated Shades", "Drum Shades", "Tapered Shades", "Velvet Shades"] },
};
function MegaMenu({ category, onClose }: { category: string; onClose: () => void }) {
  const { navigate } = useApp();
  const data = MEGA_DATA[category];
  if (!data) return null;
  const categorySlug = category === "LAMPS" ? "lighting" : category.toLowerCase();

  return (
    <div className="absolute top-full left-0 right-0 border-t border-[#DBD5C7] z-50 bg-white shadow-[0_16px_48px_-8px_rgba(26,24,21,0.18)]">
      <div className="max-w-[1440px] mx-auto px-8 py-7">
        <p className="text-[10px] font-medium tracking-widest uppercase text-[#A67C3D] mb-5">Shop {category.toLowerCase()}</p>
        <ul className="grid grid-cols-5 gap-5">
          {data.links.map((link) => (
            <li key={link}>
              <button
                onClick={() => { navigate("listing", { category: categorySlug }); onClose(); }}
                className="text-[13px] text-[#4A463F] hover:text-[#A67C3D] transition-colors text-left"
              >
                {link}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
function Header() {
  const { cartCount, wishlist, user, navigate, openMiniCart, openSearch } = useApp();
  const [activeMega, setActiveMega] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileActiveMenu, setMobileActiveMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const onEnter = (label: string, hasMega: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    setActiveMega(hasMega ? label : null);
  };
  const onLeave = () => {
    timer.current = setTimeout(() => setActiveMega(null), 160);
  };

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50" onMouseLeave={onLeave}>
        {/* Utility bar */}
        <div
          className="home-header-utility bg-[#1A1815] text-[#FFFFFF] text-center overflow-hidden transition-all duration-300"
          style={{ height: scrolled ? 0 : 28, opacity: scrolled ? 0 : 1 }}
        >
          <div className="h-7 flex items-center justify-center text-[11px] tracking-wide gap-1">
            Complimentary delivery on orders over ৳15,000 ·{" "}
            <button className="underline hover:text-[#C9A362] transition-colors">Track your order</button>
          </div>
        </div>

        {/* Main bar */}
        <div
          className="home-header-bar bg-white border-b border-[#DBD5C7] transition-all duration-300"
          style={{
            height: scrolled ? 58 : 64,
            backdropFilter: scrolled || activeMega ? "blur(12px)" : undefined,
            WebkitBackdropFilter: scrolled || activeMega ? "blur(12px)" : undefined,
            boxShadow: scrolled ? "0 4px 24px -8px rgba(26,24,21,0.12)" : "none",
          }}
        >
          <div className="max-w-[1440px] mx-auto px-3 md:px-6 h-full flex items-center gap-2 md:gap-6">
                        <button
              className="lg:hidden text-[#1A1815]"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            {/* Wordmark */}
            <button
              onClick={() => navigate("home")}
              className="home-header-wordmark tracking-[0.15em] text-[#1A1815] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A67C3D] rounded-sm"
              style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: "clamp(12px, 4vw, 18px)" }}
            >
              Cloud Lamps & Mirrors
            </button>

            {/* Nav */}
            <nav className="home-header-nav hidden lg:flex items-center gap-7 flex-1 ml-8">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.label}
                  onMouseEnter={() => onEnter(item.label, item.hasMega)}
                  onClick={() => { item.page ? navigate(item.page) : navigate("listing", { category: item.slug }); setActiveMega(null); }}
                  className={`relative text-[11px] font-medium tracking-widest uppercase transition-colors group/nav py-1 focus-visible:outline-none ${item.page ? "text-[#A67C3D] hover:text-[#805B32]" : "text-[#4A463F] hover:text-[#1A1815]"}`}
                >
                  {item.label}
                  <span className="absolute bottom-0 left-0 h-px bg-[#A67C3D] transition-all duration-300 origin-left group-hover/nav:w-full w-0" />
                </button>
              ))}
            </nav>

            {/* Actions */}
            <div className="home-header-actions flex items-center gap-1 ml-auto">
              {[
                { icon: Search, label: "Search", action: openSearch },
                { icon: User, label: user ? "My account" : "Sign in", action: () => navigate(user ? "account" : "login") },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  aria-label={label}
                  onClick={action}
                  className="hidden sm:flex w-10 h-10 items-center justify-center text-[#4A463F] hover:text-[#1A1815] rounded-[4px] hover:bg-[#FFFFFF] transition-colors"
                >
                  <Icon size={18} strokeWidth={1.5} />
                </button>
              ))}

              <button
                aria-label={`Wishlist (${wishlist.length})`}
                onClick={() => navigate("wishlist")}
                className="relative hidden sm:flex w-10 h-10 items-center justify-center text-[#4A463F] hover:text-[#1A1815] rounded-[4px] hover:bg-[#FFFFFF] transition-colors"
              >
                <Heart size={18} strokeWidth={1.5} />
                {wishlist.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-[14px] h-[14px] bg-[#1A1815] text-[#FFFFFF] text-[9px] flex items-center justify-center rounded-full">
                    {wishlist.length}
                  </span>
                )}
              </button>

              <button
                onClick={openMiniCart}
                aria-label={`Cart (${cartCount})`}
                className="relative flex w-10 h-10 items-center justify-center text-[#4A463F] hover:text-[#1A1815] rounded-[4px] hover:bg-[#FFFFFF] transition-colors"
              >
                <ShoppingBag size={18} strokeWidth={1.5} />
                {cartCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-[14px] h-[14px] bg-[#A67C3D] text-[#FFFFFF] text-[9px] flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mega */}
        {activeMega && (
          <div onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); }}>
            <MegaMenu category={activeMega} onClose={() => setActiveMega(null)} />
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <div className="absolute inset-0 bg-black/25" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }} onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[88vw] bg-[#FFFFFF] overflow-y-auto flex flex-col shadow-[16px_0_48px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between p-5 border-b border-[#DBD5C7]">
              <span style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 15, letterSpacing: "0.12em" }} className="text-[#1A1815]">
                Cloud Lamps & Mirrors
              </span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-[#4A463F] hover:text-[#1A1815]">
                <X size={20} />
              </button>
            </div>
            <nav className="px-5 py-2 flex-1">
              {NAV_ITEMS.map((item) => {
                const expanded = mobileActiveMenu === item.label;
                const subcategories = MEGA_DATA[item.label]?.links ?? [];
                if (!item.hasMega) {
                  return (
                    <button
                      key={item.label}
                      onClick={() => { item.page ? navigate(item.page) : navigate("listing", { category: item.slug }); setMobileOpen(false); setMobileActiveMenu(null); }}
                      className="w-full text-left text-[13px] font-medium text-[#1A1815] py-4 border-b border-[#DBD5C7] flex items-center justify-between"
                    >
                      {item.label}
                      
                    </button>
                  );
                }
                return (
                  <div key={item.label} className="border-b border-[#DBD5C7]">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setMobileActiveMenu(expanded ? null : item.label)}
                      className="w-full text-left text-[13px] font-medium text-[#1A1815] py-4 flex items-center justify-between"
                    >
                      {item.label}
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1A1815] text-white"><ChevronRight size={14} className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} /></span>
                    </button>
                    {expanded && (
                      <div className="pb-3 pl-3 flex flex-col">
                        {subcategories.map((subcategory) => (
                          <button
                            key={subcategory}
                            onClick={() => { navigate("listing", { category: item.slug }); setMobileOpen(false); setMobileActiveMenu(null); }}
                            className="w-full text-left text-[13px] text-[#4A463F] py-2.5 hover:text-[#1A1815] transition-colors"
                          >
                            {subcategory}
                          </button>
                        ))}
                        <button
                          onClick={() => { navigate("listing", { category: item.slug }); setMobileOpen(false); setMobileActiveMenu(null); }}
                          className="w-full text-left text-[11px] font-semibold tracking-wide uppercase text-[#C9A362] pt-3 pb-2"
                        >
                          Shop all {item.label.toLowerCase()} <ArrowRight size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI-CART DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function MiniCartDrawer() {
  const { cart, miniCartOpen, closeMiniCart, updateQty, removeFromCart, navigate, cartSubtotal } = useApp();

  return (
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/30 transition-opacity duration-300"
        style={{ opacity: miniCartOpen ? 1 : 0, pointerEvents: miniCartOpen ? "auto" : "none" }}
        onClick={closeMiniCart}
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-[400px] max-w-full bg-[#FFFFFF] z-[201] flex flex-col transition-transform duration-300"
        style={{
          transform: miniCartOpen ? "translateX(0)" : "translateX(100%)",
          boxShadow: "-16px 0 48px -8px rgba(26,24,21,0.18)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#DBD5C7]">
          <h2 className="text-[14px] font-semibold text-[#1A1815]">
            Your cart {cart.length > 0 && <span className="text-[#8A8377] font-normal">({cart.length})</span>}
          </h2>
          <button onClick={closeMiniCart} className="text-[#4A463F] hover:text-[#1A1815] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <ShoppingBag size={32} strokeWidth={1} className="text-[#DBD5C7] mb-4" />
              <p className="text-[14px] text-[#8A8377] mb-5">Your cart is empty</p>
              <button
                onClick={() => { navigate("listing"); closeMiniCart(); }}
                className="text-[10px] font-medium tracking-widest uppercase text-[#1A1815] underline underline-offset-2 hover:text-[#A67C3D] transition-colors"
              >
                Explore new arrivals
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="w-20 h-24 rounded-[8px] overflow-hidden bg-[#FFFFFF] shrink-0">
                  <img src={item.product.images.silo} alt={item.product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-[12px] font-semibold text-[#1A1815] leading-snug">{item.product.name}</h4>
                    <button onClick={() => removeFromCart(item.id)} className="text-[#8A8377] hover:text-[#1A1815] transition-colors shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                  {(item.selectedColor || item.selectedSize || item.selectedFabric || item.selectedLeg) && (
                    <p className="text-[11px] text-[#8A8377] mb-2">{[item.selectedSize, item.selectedColor, item.selectedFabric, item.selectedLeg].filter(Boolean).join(" · ")}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-[#DBD5C7] rounded-[4px] h-8">
                      <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-8 flex items-center justify-center text-[#4A463F] hover:text-[#1A1815] transition-colors">
                        <Minus size={11} />
                      </button>
                      <span className="w-6 text-center text-[12px] font-medium text-[#1A1815]">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-8 flex items-center justify-center text-[#4A463F] hover:text-[#1A1815] transition-colors">
                        <Plus size={11} />
                      </button>
                    </div>
                    <span className="text-[13px] font-medium text-[#1A1815]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="px-6 py-5 border-t border-[#DBD5C7] space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[14px] text-[#4A463F]">Subtotal</span>
              <span className="text-[15px] font-medium text-[#1A1815]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatPrice(cartSubtotal)}
              </span>
            </div>
            <button
              onClick={() => { navigate("checkout"); closeMiniCart(); }}
              className="w-full bg-[#1A1815] text-[#FFFFFF] text-[11px] font-medium tracking-widest uppercase py-3.5 rounded-[4px] hover:bg-[#2E2A24] transition-colors flex items-center justify-center gap-2"
            >
              Checkout <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={closeMiniCart}
              className="w-full rounded-[4px] border border-[#DBD5C7] py-3 text-[10px] font-medium tracking-widest uppercase text-[#4A463F] transition-colors hover:border-[#A67C3D] hover:text-[#A67C3D]"
            >
              Continue shopping
            </button>
            <button
              onClick={() => { navigate("cart"); closeMiniCart(); }}
              className="w-full text-center text-[10px] font-medium tracking-widest uppercase text-[#4A463F] hover:text-[#1A1815] transition-colors py-1"
            >
              View cart
            </button>
            <p className="text-center text-[11px] text-[#8A8377] flex items-center justify-center gap-1.5">
              <Check size={11} className="text-[#6F7D5E]" />
              Complimentary delivery included
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOASTER
// ─────────────────────────────────────────────────────────────────────────────

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { openMiniCart } = useApp();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const start = Date.now();
    const dur = 4000;
    const iv = setInterval(() => {
      const pct = 1 - Math.min(1, (Date.now() - start) / dur);
      setProgress(pct);
      if (pct <= 0) {
        clearInterval(iv);
        setVisible(false);
        setTimeout(onDismiss, 300);
      }
    }, 50);
    return () => { clearInterval(iv); cancelAnimationFrame(raf); };
  }, [onDismiss]);

  return (
    <div
      className="flex overflow-hidden rounded-[4px] border border-[#DBD5C7] bg-[#FFFFFF] transition-all duration-300"
      style={{
        width: 320,
        boxShadow: "0 8px 24px -4px rgba(26,24,21,0.15)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div className="w-1 shrink-0 bg-[#6F7D5E]" />
      <div className="flex-1 p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-14 rounded-[4px] overflow-hidden bg-[#FFFFFF] shrink-0">
            <img src={toast.product.images.silo} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#1A1815] mb-0.5">Added to cart</p>
            <p className="text-[11px] text-[#4A463F] truncate">{toast.product.name}</p>
            {toast.variant && <p className="text-[10px] text-[#8A8377]">{toast.variant}</p>}
            <button
              onClick={() => { onDismiss(); openMiniCart(); }}
              className="text-[10px] font-medium tracking-widest uppercase text-[#A67C3D] mt-1.5 hover:text-[#6B4B32] transition-colors"
            >
              View cart
            </button>
          </div>
          <button onClick={onDismiss} className="text-[#8A8377] hover:text-[#1A1815] transition-colors shrink-0">
            <X size={13} />
          </button>
        </div>
        <div className="h-px bg-[#FFFFFF] overflow-hidden rounded-full">
          <div
            className="h-full bg-[#A67C3D] origin-left transition-all duration-75 ease-linear"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </div>
    </div>
  );
}

function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-3 items-end" aria-live="polite">
      {toasts.slice(-3).map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────

function SocialMarks({ placement }: { placement: "hero" | "footer" }) {
  const networks = ["Facebook", "Instagram", "WhatsApp"] as const;
  const networkHover: Record<(typeof networks)[number], string> = {
    Facebook: "hover:border-[#1877F2] hover:bg-[#EDF4FF] hover:text-[#1877F2]",
    Instagram: "hover:border-[#C13584] hover:bg-[#FCEEF5] hover:text-[#C13584]",
    WhatsApp: "hover:border-[#25D366] hover:bg-[#EAF8EF] hover:text-[#16813A]",
  };
  return (
    <div role="group" aria-label="Social media" className={`flex items-center ${placement === "hero" ? "gap-1.5 sm:gap-2.5" : "gap-3"}`}>
      {networks.map((network) => (
        <span key={network} role="img" title={network} aria-label={network} className={`flex items-center justify-center text-[#11110F] ${placement === "hero" ? "h-8 w-8 rounded-full bg-[#FFFFFF]/90 shadow-sm backdrop-blur-sm sm:h-11 sm:w-11" : `h-11 w-11 rounded-full border border-[#D7D2C9] bg-white transition-colors duration-200 ${networkHover[network]}`}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className={placement === "hero" ? "h-3.5 w-3.5 sm:h-5 sm:w-5" : "h-[22px] w-[22px]"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {network === "Facebook" && <path fill="currentColor" stroke="none" d="M13.2 21v-8.2H16l.42-3.2H13.2V7.56c0-.93.26-1.56 1.6-1.56h1.7V3.13A22.5 22.5 0 0 0 14.02 3C11.55 3 9.86 4.5 9.86 7.27V9.6H7.07v3.2h2.79V21h3.34Z" />}
            {network === "Instagram" && <><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.1" /><circle cx="12" cy="12" r="4.1" /><circle cx="17.75" cy="6.5" r=".8" fill="currentColor" stroke="none" /></>}
            {network === "WhatsApp" && <><path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L3.5 20l1.1-4.4a8.2 8.2 0 1 1 15.6-3.9Z" /><path d="M8.2 8.1c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.8 1.8c.1.2.1.4 0 .6l-.6.8c-.2.2-.2.4 0 .6.4.7 1.1 1.4 1.8 1.8.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.6-.2l1.8.9c.3.1.4.3.4.5 0 .3-.2 1.1-.7 1.5-.5.5-1.2.7-1.8.6-1-.1-2.3-.7-3.5-1.8-1.3-1.1-2.1-2.5-2.4-3.4-.3-.9-.1-1.8.3-2.5Z" /></>}
          </svg>
        </span>
      ))}
    </div>
  );
}

function Footer() {
  const { navigate } = useApp();
  const shopLinks = [
    { label: "All collections", category: "all" },
    { label: "Lighting", category: "lighting" },
    { label: "Mirrors", category: "mirrors" },
    { label: "Tables", category: "tables" },
    { label: "Shades", category: "shades" },
  ];
  const serviceLinks = [
    { label: "Custom requests", action: () => navigate("custom-request") },
    { label: "Browse all products", action: () => navigate("listing") },
  ];
  const faqs = [
    { question: "How long does delivery take?", answer: "Standard delivery usually takes 5–10 business days. We’ll confirm the expected timing with your order." },
    { question: "Is delivery complimentary?", answer: "Delivery is complimentary on orders over ৳15,000." },
    { question: "Can I request a custom piece?", answer: "Yes. Send us your idea and any reference photos through the Custom Product Request form, and our team will follow up." },
  ];
  const linkClass = "text-[14px] leading-6 text-[#514D47] transition-colors hover:text-[#A67C3D] focus-visible:outline-none focus-visible:underline";

  return (
    <footer className="border-t border-[#E8E4DC] bg-[#FFFFFF] text-[#171614]">
      <div className="mx-auto max-w-[1520px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16 xl:-translate-x-5">
        <div className="grid gap-8 border-b border-[#DEDAD2] pb-9 md:grid-cols-2 md:gap-10 md:pb-12 xl:grid-cols-[1.45fr_0.82fr_0.9fr_0.95fr_1.2fr]">
          <div className="pb-1 md:pr-8">
            <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-[#827B70]">Lighting for considered living</p>
            <p className="mb-5 max-w-sm font-serif text-[22px] leading-snug sm:text-[26px]">Make room for a little more light.</p>
            <p className="max-w-sm text-[14px] leading-6 text-[#68635B]">Thoughtful lamps, mirrors, shades, and tables chosen to bring warmth and character home.</p>
            <div className="mt-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#68635B]">Follow us</p>
              <SocialMarks placement="footer" />
            </div>
          </div>

          <div className="hidden md:block">
            <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.16em]">Explore</p>
            <ul className="space-y-2.5">
              {shopLinks.map((link) => <li key={link.label}><button className={linkClass} onClick={() => navigate("listing", { category: link.category })}>{link.label}</button></li>)}
            </ul>
          </div>

          <div className="hidden md:block">
            <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.16em]">Customer care</p>
            <ul className="space-y-2.5">
              {serviceLinks.map((link) => <li key={link.label}><button className={linkClass} onClick={link.action}>{link.label}</button></li>)}
            </ul>
          </div>

          <div className="hidden md:block">
            <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.16em]">Our promise</p>
            <p className="max-w-xs text-[14px] leading-6 text-[#68635B]">Pieces selected with care, made to bring enduring warmth and thoughtful detail to your home.</p>
          </div>

          <div className="hidden md:block">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em]">FAQs</p>
            <div className="divide-y divide-[#DEDAD2] border-y border-[#DEDAD2]">
              {faqs.map((faq) => <details key={faq.question} className="group py-3"><summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[12px] font-medium text-[#3F3B35] marker:hidden">{faq.question}<span aria-hidden="true" className="text-sm leading-none text-[#8A8377] transition-transform group-open:rotate-45">+</span></summary><p className="pt-2 pr-3 text-[11px] leading-5 text-[#777168]">{faq.answer}</p></details>)}
            </div>
          </div>

          <div className="divide-y divide-[#DEDAD2] border-y border-[#DEDAD2] md:hidden">
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold uppercase tracking-[0.16em]">Explore <span className="text-lg font-normal transition-transform group-open:rotate-45">+</span></summary>
              <ul className="space-y-2.5 pt-4">
                {shopLinks.map((link) => <li key={link.label}><button className={linkClass} onClick={() => navigate("listing", { category: link.category })}>{link.label}</button></li>)}
              </ul>
            </details>
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold uppercase tracking-[0.16em]">Customer care <span className="text-lg font-normal transition-transform group-open:rotate-45">+</span></summary>
              <ul className="space-y-2.5 pt-4">
                {serviceLinks.map((link) => <li key={link.label}><button className={linkClass} onClick={link.action}>{link.label}</button></li>)}
              </ul>
            </details>
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold uppercase tracking-[0.16em]">FAQs <span className="text-lg font-normal transition-transform group-open:rotate-45">+</span></summary>
              <div className="divide-y divide-[#DEDAD2] pt-2">
                {faqs.map((faq) => <details key={faq.question} className="group/faq py-3"><summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[12px] font-medium text-[#3F3B35]">{faq.question}<span aria-hidden="true" className="text-sm leading-none text-[#8A8377] transition-transform group-open/faq:rotate-45">+</span></summary><p className="pt-2 pr-3 text-[11px] leading-5 text-[#777168]">{faq.answer}</p></details>)}
              </div>
            </details>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-[12px] text-[#777168]">© 2026 Cloud Lamps &amp; Mirrors. All rights reserved.</p>
          <button type="button" onClick={() => navigate("custom-request")} className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#514D47] transition-colors hover:text-[#A67C3D]">Need something made to order? <span className="underline underline-offset-4">Get in touch</span></button>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME — HERO
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  const { navigate, homepageContent } = useApp();
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const slides = homepageContent.heroSlides.filter((item) => item.active);
  const activeSlides = slides.length ? slides : DEFAULT_HOMEPAGE_CONTENT.heroSlides;
  const activeIndex = idx % activeSlides.length;
  const slide = activeSlides[activeIndex];
  const changeSlide = (direction: number) => {
    setIdx((current) => (current + direction + activeSlides.length) % activeSlides.length);
    setFading(false);
  };

  return (
    <section className="home-hero-banner relative h-[clamp(380px,48vw,620px)] flex items-end pb-14 overflow-hidden">
      {activeSlides.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === activeIndex ? 1 : 0 }}
        >
          <img src={s.image} alt={s.alt} onError={handleImgError} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#18242E]/55 via-[#263847]/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12191F]/35 via-transparent to-transparent" />
        </div>
      ))}

      <div className="home-hero-copy relative max-w-[1440px] mx-auto px-8 w-full">
        <div className="max-w-xl">
          <p
            className="text-[10px] font-medium tracking-widest uppercase text-[#C9A362] mb-5 transition-all duration-500"
            style={{ opacity: fading ? 0 : 1, transform: fading ? "translateY(6px)" : "translateY(0)" }}
          >
            {slide.eyebrow}
          </p>
          <h1
            className="text-[#FFFFFF] font-light leading-none mb-6 transition-all duration-500 whitespace-pre-line"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(38px, 5.5vw, 76px)",
              letterSpacing: "-0.02em",
              opacity: fading ? 0 : 1,
              transform: fading ? "translateY(10px)" : "translateY(0)",
              transitionDelay: "40ms",
            }}
          >
            {slide.headline}
          </h1>
          <p
            className="text-[#FFFFFF]/75 text-[16px] font-light mb-9 transition-all duration-500"
            style={{
              opacity: fading ? 0 : 1,
              transform: fading ? "translateY(6px)" : "translateY(0)",
              transitionDelay: "80ms",
            }}
          >
            {slide.subtext}
          </p>
          <div className="flex items-center gap-5">
            <button
              onClick={() => navigate("listing", { category: slide.categorySlug })}
              className="inline-flex items-center gap-2 bg-[#FFFFFF] text-[#1A1815] text-[11px] font-medium tracking-widest uppercase px-7 py-3.5 rounded-[4px] hover:bg-white transition-colors"
            >
              {slide.ctaLabel} <ArrowRight size={13} />
            </button>
            <button className="text-[11px] font-medium tracking-widest uppercase text-[#FFFFFF] hover:text-[#C9A362] transition-colors underline underline-offset-2">
              Our story
            </button>
          </div>
        </div>
      </div>

      {/* Manual slide controls */}
      <button type="button" aria-label="Previous banner" onClick={() => changeSlide(-1)} className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border border-white/45 bg-white/75 text-[#27323A] shadow-sm backdrop-blur-sm transition hover:bg-white">
        <ChevronLeft size={20} />
      </button>
      <button type="button" aria-label="Next banner" onClick={() => changeSlide(1)} className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border border-white/45 bg-white/75 text-[#27323A] shadow-sm backdrop-blur-sm transition hover:bg-white">
        <ChevronRight size={20} />
      </button>

      {/* Social marks replace the decorative slide pagination. */}
      <div className="absolute bottom-4 right-8 z-10 sm:bottom-6 sm:right-24 md:bottom-7 md:right-28">
        <SocialMarks placement="hero" />
      </div>

      {/* Scroll cue */}
      <div className="home-hero-scroll-cue absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-50">
        <div className="w-px h-10 bg-white animate-pulse" />
        <ChevronDown size={13} className="text-white" />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME — CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

function CategorySection() {
  const { navigate, homepageContent } = useApp();
  const categories = homepageContent.categories.filter((category) => category.active);
  return (
    <section className="mx-auto max-w-[1800px] bg-white px-5 py-10 sm:px-8 md:py-14 xl:px-10">
      <Reveal>
        <div className="mb-6 flex items-center justify-between gap-4 md:mb-7">
          <h2 className="text-xl font-semibold uppercase tracking-[0.04em] text-[#1A1815] sm:text-2xl" style={{ fontFamily: "Inter, sans-serif" }}>
            Top Categories
          </h2>
          <button type="button" onClick={() => navigate("listing")} className="shrink-0 rounded-full border border-[#A67C3D] px-5 py-2 text-xs font-medium text-[#1A1815] transition-colors hover:bg-[#A67C3D] hover:text-white sm:px-6 sm:py-2.5">
            View All
          </button>
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-6">
        {categories.map((category, index) => (
          <Reveal key={category.slug} delay={index * 70}>
            <button type="button" onClick={() => navigate("listing", { category: category.slug })} aria-label={`Browse ${category.name}`} className="group block w-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A67C3D] focus-visible:ring-offset-4">
              <span className="relative mb-3 block aspect-square overflow-hidden rounded-[4px] bg-[#FFFFFF]">
                <img src={category.image} alt={category.alt} onError={handleImgError} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/25 group-focus-visible:bg-black/25">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-2xl font-light text-[#1A1815] opacity-0 shadow-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">+</span>
                </span>
              </span>
              <span className="block px-1 text-[13px] font-semibold leading-snug text-[#1A1815] transition-colors group-hover:text-[#8A642E] sm:text-sm">{category.name}</span>
            </button>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME — BRAND BENTO
// ─────────────────────────────────────────────────────────────────────────────

function CountUp({ value, duration = 2600 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const numberRef = useRef<HTMLSpanElement>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const node = numberRef.current;
    if (!node) return;

    let frame = 0;
    let isAnimating = false;
    const animate = () => {
      if (isAnimating || hasAnimatedRef.current) return;
      hasAnimatedRef.current = true;
      isAnimating = true;
      setCount(0);
      const startTime = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(value * eased));
        if (progress < 1) frame = requestAnimationFrame(tick);
        else isAnimating = false;
      };
      frame = requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) {
      animate();
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimatedRef.current) {
        animate();
        observer.disconnect();
      }
    }, { threshold: 0, rootMargin: "0px 0px -5% 0px" });

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return <span ref={numberRef} aria-label={`${value.toLocaleString()}+`}>{count.toLocaleString()}<span className="text-[0.72em] align-top ml-0.5">+</span></span>;
}

function BrandBento() {
  return (
    <Reveal>
      <section
        className="relative isolate overflow-hidden py-16 md:py-24"
        style={{ backgroundImage: "radial-gradient(ellipse at 16% 46%, rgba(160,178,189,0.2), transparent 36%), radial-gradient(ellipse at 82% 10%, rgba(175,163,190,0.14), transparent 31%), radial-gradient(ellipse at 72% 88%, rgba(146,174,189,0.15), transparent 35%), repeating-linear-gradient(132deg, rgba(80,95,110,0.022) 0px, rgba(80,95,110,0.022) 1px, transparent 1px, transparent 86px), linear-gradient(125deg, #F8F7F3 0%, #F0F2F3 48%, #F5F3F7 100%)" }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute -left-36 top-28 h-72 w-72 rounded-full border border-[#8296A2]/20 shadow-[0_0_90px_rgba(161,184,191,0.10)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full border border-[#9487A3]/20" />
        <div className="max-w-[1440px] mx-auto px-5 md:px-8">
          <div className="mb-9 md:mb-11 flex items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#8B642E] mb-3">Why Cloud Lamps & Mirrors</p>
              <h2 className="text-[30px] md:text-[38px] font-light text-[#20242A]" style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.02em" }}>
                Details that shape a room
              </h2>
            </div>
            <span className="hidden sm:inline-flex items-center gap-2 text-[9px] tracking-[0.16em] uppercase text-[#766F65] pb-1">
              <span className="w-7 h-px bg-[#C9A362]" /> Thoughtfully made
            </span>
          </div>

          {/* Desktop bento */}
          <div className="relative hidden lg:grid lg:grid-cols-12 lg:grid-rows-2 gap-4" style={{ height: 460 }}>
            <div className="relative overflow-hidden col-span-5 row-span-2 rounded-2xl border border-[#D1D8DD] bg-[#E4E8EB] p-9 flex flex-col justify-end shadow-[0_24px_70px_rgba(45,58,68,0.10)] group" style={{ backgroundImage: "radial-gradient(circle at 78% 20%, rgba(178,166,194,0.28), transparent 29%), radial-gradient(circle at 15% 92%, rgba(130,163,180,0.24), transparent 35%), linear-gradient(145deg, #E8EBED 0%, #DCE2E5 72%)" }}>
              <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full border border-[#62717D]/[0.12] transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute -right-5 -top-5 w-52 h-52 rounded-full border border-[#62717D]/[0.12]" />
              <div className="absolute right-[4.5rem] top-[4.5rem] w-3 h-3 rounded-full bg-[#C9A362] shadow-[0_0_28px_rgba(201,163,98,0.75)]" />
              <div className="relative z-10">
                <p className="text-[9px] font-medium tracking-[0.2em] uppercase text-[#8B642E] mb-5">Crafted with intention</p>
                <h3 className="text-[30px] font-light text-[#20242A] leading-tight mb-5 whitespace-pre-line" style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.02em" }}>
                  {"Museum-grade craft,\nhonest price."}
                </h3>
                <p className="max-w-[390px] text-[13px] text-[#48515A] leading-relaxed">
                  Every piece at Cloud Lamps & Mirrors is chosen to shape the light, mood, and character of a room.
                </p>
              </div>
              <span className="absolute top-7 left-8 text-[10px] tracking-[0.18em] text-[#67717A]">01 / OUR PROMISE</span>
            </div>

            <div className="relative overflow-hidden col-span-3 bg-gradient-to-br from-white/80 via-[#F8F6F1] to-[#EEE9DF] border border-[#DCD3C2] rounded-2xl p-7 flex flex-col justify-center shadow-[0_12px_36px_rgba(70,54,29,0.05)] group">
              <span className="absolute -right-5 -top-8 w-28 h-28 rounded-full border border-[#A67C3D]/15 group-hover:scale-110 transition-transform duration-500" />
              <p className="relative text-[48px] font-light text-[#1A1815] leading-none mb-3" style={{ fontFamily: "'Fraunces', serif" }}><CountUp value={2400} /></p>
              <p className="relative text-[10px] tracking-[0.16em] uppercase text-[#8A8377]">Homes illuminated</p>
              <span className="absolute bottom-0 left-7 right-7 h-[2px] bg-gradient-to-r from-[#C9A362] via-[#C9A362]/40 to-transparent" />
            </div>

            <div className="relative overflow-hidden col-span-4 bg-gradient-to-br from-[#F0EEF3] to-[#E5E2EA] border border-white/70 rounded-2xl p-7 flex flex-col justify-center shadow-[0_12px_36px_rgba(70,54,29,0.05)] group">
              <span className="absolute -right-6 -top-9 w-32 h-32 rounded-full border border-[#625B70]/15 group-hover:scale-110 transition-transform duration-500" />
              <span className="absolute right-8 top-8 w-2 h-2 rounded-full bg-[#766F84]" />
              <p className="relative text-[48px] font-light text-[#625B70] leading-none mb-3" style={{ fontFamily: "'Fraunces', serif" }}><CountUp value={40} /></p>
              <p className="relative text-[10px] tracking-[0.16em] uppercase text-[#625B70]/80">Artisan partners</p>
            </div>

            <div className="relative overflow-hidden col-span-3 bg-gradient-to-br from-white/75 to-[#F1ECE1] border border-[#DED7C9] rounded-2xl p-7 shadow-[0_12px_36px_rgba(70,54,29,0.05)] transition-transform duration-300 hover:-translate-y-1">
              <div className="w-9 h-9 rounded-full bg-[#EDE3D0] flex items-center justify-center mb-5">
                <Package size={16} className="text-[#A67C3D]" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-[#1A1815] mb-1.5">Ready to ship</p>
              <p className="text-[11px] text-[#8A8377] leading-relaxed">Small-batch pieces, checked before dispatch.</p>
            </div>

            <div className="relative overflow-hidden col-span-4 bg-gradient-to-br from-[#EEF0E8] to-[#E4E7DB] border border-white/70 rounded-2xl p-7 shadow-[0_12px_36px_rgba(70,54,29,0.05)] transition-transform duration-300 hover:-translate-y-1">
              <div className="w-9 h-9 rounded-full bg-[#6F7D5E]/15 flex items-center justify-center mb-5">
                <Shield size={16} className="text-[#6F7D5E]" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-[#1A1815] mb-1.5">Quality materials</p>
              <p className="text-[11px] text-[#4A463F] leading-relaxed">Considered materials: glass, brass, linen, and solid wood.</p>
            </div>
          </div>

          {/* Mobile bento */}
          <div className="relative lg:hidden grid grid-cols-2 gap-3.5 md:gap-4">
            <div className="relative overflow-hidden col-span-2 rounded-2xl border border-[#D1D8DD] bg-[#E4E8EB] p-6 shadow-[0_18px_48px_rgba(45,58,68,0.10)] md:p-7" style={{ backgroundImage: "radial-gradient(circle at 90% 8%, rgba(178,166,194,0.28), transparent 32%), radial-gradient(circle at 12% 100%, rgba(130,163,180,0.24), transparent 36%), linear-gradient(145deg, #E8EBED 0%, #DCE2E5 72%)" }}>
              <div className="absolute -right-9 -top-12 w-44 h-44 rounded-full border border-[#62717D]/[0.12]" />
              <div className="absolute right-8 top-8 w-2 h-2 rounded-full bg-[#C9A362] shadow-[0_0_20px_rgba(201,163,98,0.8)]" />
              <div className="relative z-10">
                <p className="text-[9px] font-medium tracking-[0.2em] uppercase text-[#8B642E] mb-3">Crafted with intention</p>
                <h3 className="text-[23px] font-light text-[#20242A] leading-tight mb-3" style={{ fontFamily: "'Fraunces', serif" }}>
                  {"Museum-grade craft,\nhonest price."}
                </h3>
                <p className="text-[12px] text-[#48515A] leading-relaxed">Every piece at Cloud Lamps &amp; Mirrors is chosen to shape the light, mood, and character of a room.</p>
              </div>
            </div>
            <div className="relative overflow-hidden bg-gradient-to-br from-white/85 via-[#F8F6F1] to-[#EEE9DF] border border-[#DCD3C2] rounded-2xl p-5 shadow-[0_10px_28px_rgba(70,54,29,0.05)]">
              <span className="absolute -right-4 -top-5 w-20 h-20 rounded-full border border-[#A67C3D]/15" />
              <p className="relative text-[36px] font-light text-[#1A1815] leading-none mb-2" style={{ fontFamily: "'Fraunces', serif" }}><CountUp value={2400} /></p>
              <p className="relative text-[9px] tracking-[0.13em] uppercase text-[#8A8377]">Homes illuminated</p>
            </div>
            <div className="relative overflow-hidden bg-gradient-to-br from-[#F0EEF3] to-[#E5E2EA] border border-white/70 rounded-2xl p-5 shadow-[0_10px_28px_rgba(70,54,29,0.05)]">
              <span className="absolute -right-4 -top-5 w-20 h-20 rounded-full border border-[#625B70]/15" />
              <p className="relative text-[36px] font-light text-[#625B70] leading-none mb-2" style={{ fontFamily: "'Fraunces', serif" }}><CountUp value={40} /></p>
              <p className="relative text-[9px] tracking-[0.13em] uppercase text-[#625B70]/80">Artisan partners</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-[#EEF0E8] to-[#E4E7DB] p-5 shadow-[0_10px_28px_rgba(70,54,29,0.05)]">
              <div className="w-8 h-8 rounded-full bg-[#6F7D5E]/15 flex items-center justify-center mb-4"><Package size={15} className="text-[#6F7D5E]" /></div>
              <p className="text-[12px] font-semibold text-[#1A1815] mb-1">Ready to ship</p>
              <p className="text-[10px] text-[#4A463F] leading-relaxed">Small-batch pieces, checked before dispatch.</p>
            </div>
            <div className="rounded-2xl border border-[#DED7C9] bg-gradient-to-br from-white/75 to-[#F1ECE1] p-5 shadow-[0_10px_28px_rgba(70,54,29,0.05)]">
              <div className="w-8 h-8 rounded-full bg-[#E8E6ED] flex items-center justify-center mb-4"><Shield size={15} className="text-[#625B70]" /></div>
              <p className="text-[12px] font-semibold text-[#1A1815] mb-1">Quality materials</p>
              <p className="text-[10px] text-[#4A463F] leading-relaxed">Considered materials: glass, brass, linen, and solid wood.</p>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
function HotDeals() {
  const { addToCart, closeMiniCart, navigate, products, homepageContent } = useApp();
  const demoDeals = homepageContent.hotDeals.filter((deal) => deal.active);

  return (
    <section className="py-16 md:py-20 bg-[#FFFFFF]">
      <div className="max-w-[1800px] mx-auto px-6 md:px-8">
        <Reveal>
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[10px] font-medium tracking-widest uppercase text-[#A67C3D] mb-3">Limited-time offers</p>
              <h2 className="text-[30px] font-light text-[#1A1815]" style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em" }}>
                Hot Deals
              </h2>
              <p className="text-[13px] text-[#8A8377] mt-2">A few favorites at special prices.</p>
            </div>
            <button
              onClick={() => navigate("listing", { category: "sale" })}
              className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium tracking-widest uppercase text-[#4A463F] hover:text-[#A67C3D] transition-colors"
            >
              View all deals <ArrowRight size={11} />
            </button>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 md:gap-x-5 gap-y-8 md:gap-y-10">
          {demoDeals.map((deal, index) => (
            <Reveal key={`${deal.name}-${index}`} delay={(index % 4) * 50}>
              {(() => {
                const product = products.find((item) => item.id === deal.productId);
                if (!product) return null;
                return (
                  <div className="group w-full text-left">
                    <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-lg bg-[#FFFFFF]">
                      <button type="button" onClick={() => navigate("product", { id: product.id })} aria-label={`View ${deal.name}`} className="absolute inset-0 h-full w-full">
                      <img src={deal.image} alt={deal.alt || deal.name} onError={handleImgError} className="absolute inset-0 h-full w-full scale-[1.12] object-cover transition-transform duration-500 group-hover:scale-[1.16]" />
                        <span className="absolute top-3 left-3 rounded-full bg-[#A64C3C] px-3 py-1.5 text-[9px] font-semibold tracking-wider uppercase text-white">Hot deal</span>
                      </button>
                      <div className="absolute inset-x-0 bottom-0 z-10 translate-y-full bg-gradient-to-t from-black/45 to-transparent px-3 pb-3 pt-12 transition-transform duration-300 group-hover:translate-y-0 group-focus-within:translate-y-0">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => addToCart(product)} className="flex-1 rounded-full bg-white/90 px-2 py-2 text-[10px] font-medium text-[#1A1815] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Add to Cart</button>
                          <button type="button" onClick={() => { addToCart(product); closeMiniCart(); navigate("checkout"); }} className="flex-1 rounded-full bg-[#1A1815] px-2 py-2 text-[10px] font-medium text-white transition-colors hover:bg-[#3A3530] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Buy Now</button>
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => navigate("product", { id: product.id })} className="w-full text-left">
                      <p className="text-[10px] font-medium tracking-widest uppercase text-[#8A8377] mb-1">{deal.category}</p>
                      <p className="text-[13px] md:text-sm font-semibold text-[#1A1815] group-hover:text-[#A67C3D] transition-colors">{deal.name}</p>
                      <div className="flex items-baseline gap-2 mt-1.5">
                        <span className="text-[13px] font-medium text-[#1A1815]">{formatPrice(deal.price)}</span>
                        <span className="text-[11px] text-[#8A8377] line-through">{formatPrice(deal.was)}</span>
                      </div>
                    </button>
                  </div>
                );
              })()}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
function EditorialBreak() {
  return (
    <section className="editorial-break relative overflow-hidden">
      <picture className="absolute inset-0 h-full w-full">
        <source
          media="(max-width: 639px)"
          srcSet="https://images.unsplash.com/photo-1737467034151-16e643c905c7?auto=format&fit=crop&crop=entropy&w=1000&h=1400&q=82"
        />
        <source
          media="(min-width: 1024px)"
          srcSet="https://images.unsplash.com/photo-1737467034151-16e643c905c7?auto=format&fit=crop&crop=entropy&w=2400&h=900&q=82"
        />
        <source
          media="(min-width: 640px)"
          srcSet="https://images.unsplash.com/photo-1737467034151-16e643c905c7?auto=format&fit=crop&crop=entropy&w=1600&h=1000&q=82"
        />
        <img
          src={U("photo-1737467034151-16e643c905c7", 1600)}
          alt="A calm purple-toned bedroom with a lamp and bookshelf"
          className="editorial-break-photo h-full w-full object-cover"
        />
      </picture>
      <div className="editorial-break-shade absolute inset-0 bg-gradient-to-r from-[#282531]/65 via-[#383343]/25 to-[#302C3A]/15" />
      <div className="relative h-full flex items-center max-w-[1440px] mx-auto px-8">
        <div className="max-w-[500px]">
          <p className="text-[10px] font-medium tracking-widest uppercase text-[#C9A362] mb-5">Our craft</p>
          <h2
            className="text-[#FFFFFF] font-light leading-tight mb-6"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(28px, 3.5vw, 42px)",
              letterSpacing: "-0.01em",
            }}
          >
            We <em>shape</em> light and <em>reflection</em> for the way you live.
          </h2>
          <p className="text-[15px] text-[#FFFFFF]/70 mb-8 leading-relaxed">
            From a softly glowing shade to a well-placed mirror, each detail helps a room feel more considered.
          </p>
          <button className="text-[10px] font-medium tracking-widest uppercase text-[#FFFFFF] flex items-center gap-2 hover:text-[#C9A362] transition-colors underline underline-offset-2">
            Read our story <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME — SERVICE STRIP
// ─────────────────────────────────────────────────────────────────────────────

function ServiceStrip() {
  const items = [
    { Icon: Truck, label: "Careful delivery", desc: "On orders over ৳15,000" },
    { Icon: Package, label: "Thoughtfully selected", desc: "Selected for everyday use" },
    { Icon: Shield, label: "1-year warranty", desc: "Lighting and mirror finish" },
    { Icon: Award, label: "Easy styling advice", desc: "Ask us for a pairing" },
  ];
  return (
    <section className="py-14 border-y border-[#DBD5C7]">
      <div className="max-w-[1440px] mx-auto px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {items.map(({ Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-4">
              <Icon size={19} className="text-[#A67C3D] mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-[12px] font-semibold text-[#1A1815] mb-0.5">{label}</p>
                <p className="text-[11px] text-[#8A8377]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME — PRE-FOOTER CTA
// ─────────────────────────────────────────────────────────────────────────────

function PreFooterCTA() {
  const { navigate } = useApp();
  return (
    <section className="py-24 bg-[#1A1815]">
      <div className="max-w-[1440px] mx-auto px-8 text-center">
        <h2
          className="font-light text-[#FFFFFF] mb-9 max-w-2xl mx-auto leading-tight"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(32px, 4vw, 52px)",
            letterSpacing: "-0.02em",
          }}
        >
          Customize your own creation at home.
        </h2>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate("custom-request")}
            className="inline-flex items-center gap-2 bg-[#FFFFFF] text-[#1A1815] text-[11px] font-medium tracking-widest uppercase px-7 py-3.5 rounded-[4px] hover:bg-white transition-colors"
          >
            Give us a reference <ArrowRight size={13} />
          </button>
          <button className="inline-flex items-center gap-2 border border-[#FFFFFF]/30 text-[#FFFFFF] text-[11px] font-medium tracking-widest uppercase px-7 py-3.5 rounded-[4px] hover:border-[#FFFFFF]/70 transition-colors">
            Chat in Messenger
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────

function HomePage() {
  return (
    <>
      <HeroSection />
      <CategorySection />
      <div className="h-px bg-[#DBD5C7] max-w-[1440px] mx-auto" />
      <HotDeals />
      <PreFooterCTA />
      <EditorialBreak />
      <ServiceStrip />
      <BrandBento />
      <Footer />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER DATA & HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const MATERIAL_OPTIONS = [
  { id: "Oak", label: "Oak Wood" },
  { id: "Walnut", label: "Walnut Wood" },
  { id: "Linen", label: "Natural Linen" },
  { id: "Cotton", label: "Cotton" },
  { id: "Velvet", label: "Velvet" },
  { id: "Marble", label: "Natural Marble" },
  { id: "Brass", label: "Brass" },
  { id: "Glass", label: "Glass" },
  { id: "Ceramic", label: "Ceramic" },
];

const COLOR_OPTIONS = [
  { id: "Beige", label: "Beige / Dune", hex: "#D8C7AD" },
  { id: "Charcoal", label: "Charcoal / Black", hex: "#3A3530" },
  { id: "Sage", label: "Sage Green", hex: "#8FA07E" },
  { id: "Ivory", label: "Ivory / Off-White", hex: "#F0EBE0" },
  { id: "Walnut", label: "Walnut Brown", hex: "#6B4B32" },
  { id: "Oak", label: "Natural Oak", hex: "#C8A96E" },
  { id: "Brass", label: "Brass / Gold", hex: "#C9A362" },
  { id: "Sand", label: "Sand / Stoneware", hex: "#C8B49A" },
  { id: "Slate", label: "Slate Grey", hex: "#6B7A8D" },
];

const BADGE_OPTIONS = [
  { id: "new", label: "New Arrivals" },
  { id: "sale", label: "Hot Deals" },
];

function matchesMaterial(p: Product, selected: string[]) {
  if (selected.length === 0) return true;
  const haystack = (
    p.name + " " +
    p.description + " " +
    (p.materials?.join(" ") || "") + " " +
    (p.fabrics?.map((f) => f.label).join(" ") || "") + " " +
    (p.legs?.map((l) => l.label).join(" ") || "")
  ).toLowerCase();
  return selected.some((m) => haystack.includes(m.toLowerCase()));
}

function matchesColor(p: Product, selected: string[]) {
  if (selected.length === 0) return true;
  return selected.some((c) =>
    p.swatches.some((s) => s.label.toLowerCase().includes(c.toLowerCase()))
  );
}

function matchesBadge(p: Product, selected: string[]) {
  if (selected.length === 0) return true;
  if (selected.includes("sale") && p.salePrice) return true;
  if (selected.includes("new") && p.badge === "new") return true;
  return false;
}

function matchesPrice(p: Product, min: number, max: number) {
  const price = (p.salePrice ?? p.basePrice) / 100;
  return price >= min && price <= max;
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTING PAGE
// ─────────────────────────────────────────────────────────────────────────────

function ListingPage({ params }: { params?: Record<string, string> }) {
  const { navigate, products } = useApp();
  const cat = params?.category || "all";
  const [sort, setSort] = useState("relevance");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
  const mobileFilterCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter States
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);

  const openMobileFilters = () => {
    if (mobileFilterCloseTimer.current) clearTimeout(mobileFilterCloseTimer.current);
    setMobileFilterClosing(false);
    setMobileFilterOpen(true);
  };
  const closeMobileFilters = () => {
    if (!mobileFilterOpen || mobileFilterClosing) return;
    setMobileFilterClosing(true);
    mobileFilterCloseTimer.current = setTimeout(() => {
      setMobileFilterOpen(false);
      setMobileFilterClosing(false);
    }, 220);
  };

  useEffect(() => {
    if (!mobileFilterOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeMobileFilters(); };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileFilterOpen]);

  // Calculate catalog min & max prices
  const catalogPrices = products.map((p) => (p.salePrice ?? p.basePrice) / 100);
  const ABS_MIN = Math.floor(Math.min(...catalogPrices) / 10) * 10;
  const ABS_MAX = Math.ceil(Math.max(...catalogPrices) / 100) * 100;

  const [minPrice, setMinPrice] = useState<number>(ABS_MIN);
  const [maxPrice, setMaxPrice] = useState<number>(ABS_MAX);

  const catLabel =
    cat === "all" ? "All Products" : CATEGORIES.find((c) => c.slug === cat)?.name || "Collection";

  // 1. Base category products
  const categoryProducts = products.filter((p) => {
    if (cat === "all") return true;
    if (cat === "sale") return !!p.salePrice;
    if (cat === "new") return p.badge === "new";
    const norm = p.category.toLowerCase().replace(/[& ]+/g, "-");
    const subcategory = p.subcategory.toLowerCase();
    if (cat === "mirrors") return subcategory.includes("mirror");
    if (cat === "tables") return subcategory.includes("table");
    if (cat === "shades") return p.category === "Shades" || subcategory.includes("shade");
    return norm.includes(cat.split("-")[0]);
  });
  const materialOptions = [...MATERIAL_OPTIONS, ...products.flatMap((p) => p.materials ?? []).filter((material, index, all) => !MATERIAL_OPTIONS.some((item) => item.id.toLowerCase() === material.toLowerCase()) && all.findIndex((x) => x.toLowerCase() === material.toLowerCase()) === index).map((material) => ({ id: material, label: material }))];
  const colorOptions = [...COLOR_OPTIONS, ...products.flatMap((p) => p.swatches).filter((swatch, index, all) => !COLOR_OPTIONS.some((item) => item.id.toLowerCase() === swatch.label.toLowerCase()) && all.findIndex((x) => x.label.toLowerCase() === swatch.label.toLowerCase()) === index).map((swatch) => ({ id: swatch.label, label: swatch.label, hex: swatch.color }))];

  const priceSpan = Math.max(1, ABS_MAX - ABS_MIN);
  const priceBuckets = Array.from({ length: 12 }, (_, index) => {
    const lower = ABS_MIN + (priceSpan * index) / 12;
    const upper = ABS_MIN + (priceSpan * (index + 1)) / 12;
    return categoryProducts.filter((p) => {
      const price = (p.salePrice ?? p.basePrice) / 100;
      return price >= lower && (index === 11 ? price <= upper : price < upper);
    }).length;
  });
  const maxPriceBucket = Math.max(1, ...priceBuckets);
  // Reset filters when category changes
  useEffect(() => {
    setSelectedMaterials([]);
    setSelectedColors([]);
    setSelectedBadges([]);
    setMinPrice(ABS_MIN);
    setMaxPrice(ABS_MAX);
  }, [cat]);

  // Dynamic count calculators (computed relative to base categoryProducts)
  const getMaterialCount = (id: string) =>
    categoryProducts.filter((p) => matchesMaterial(p, [id])).length;
  const getColorCount = (id: string) =>
    categoryProducts.filter((p) => matchesColor(p, [id])).length;
  const getBadgeCount = (id: string) =>
    categoryProducts.filter((p) => matchesBadge(p, [id])).length;

  // 2. Fully filtered products
  const filtered = categoryProducts.filter((p) => {
    if (!matchesMaterial(p, selectedMaterials)) return false;
    if (!matchesColor(p, selectedColors)) return false;
    if (!matchesBadge(p, selectedBadges)) return false;
    if (!matchesPrice(p, minPrice, maxPrice)) return false;
    return true;
  });

  // 3. Sorted products
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price-asc") return (a.salePrice ?? a.basePrice) - (b.salePrice ?? b.basePrice);
    if (sort === "price-desc") return (b.salePrice ?? b.basePrice) - (a.salePrice ?? a.basePrice);
    if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    if (sort === "newest") return (a.badge === "new" ? -1 : 1);
    return 0;
  });

  // Toggle helpers
  const toggleMaterial = (id: string) =>
    setSelectedMaterials((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const toggleColor = (id: string) =>
    setSelectedColors((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const toggleBadge = (id: string) =>
    setSelectedBadges((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const resetAllFilters = () => {
    setSelectedMaterials([]);
    setSelectedColors([]);
    setSelectedBadges([]);
    setMinPrice(ABS_MIN);
    setMaxPrice(ABS_MAX);
  };

  const activeFilterCount =
    selectedMaterials.length +
    selectedColors.length +
    selectedBadges.length +
    (minPrice > ABS_MIN || maxPrice < ABS_MAX ? 1 : 0);

  // Render Filter Controls Content
  const renderFilterSidebar = () => (
    <div className="space-y-7">
      {/* Special Collection / Badge Filter */}
      <div className="pb-6 border-b border-[#DBD5C7]">
        <p className="text-[11px] font-semibold tracking-wider uppercase text-[#1A1815] mb-3.5">
          Special Edition
        </p>
        <div className="space-y-2">
          {BADGE_OPTIONS.map((opt) => {
            const cnt = getBadgeCount(opt.id);
            const isChecked = selectedBadges.includes(opt.id);
            return (
              <label
                key={opt.id}
                onClick={() => toggleBadge(opt.id)}
                className={`flex items-center justify-between cursor-pointer py-1 px-2 rounded-md transition-colors ${
                  isChecked ? "bg-[#EDE3D0]/60 font-medium" : "hover:bg-[#FFFFFF]/50"
                } ${cnt === 0 ? "opacity-45 pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isChecked
                        ? "bg-[#1A1815] border-[#1A1815] text-[#FFFFFF]"
                        : "border-[#B9B1A0] bg-white"
                    }`}
                  >
                    {isChecked && <Check size={11} strokeWidth={3} />}
                  </div>
                  <span className="text-[13px] text-[#1A1815]">{opt.label}</span>
                </div>
                <span className="text-[11px] font-mono text-[#8A8377]">({cnt})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Price Range Filter */}
      <div className="pb-6 border-b border-[#DBD5C7]">
        <div className="flex items-center justify-between mb-3.5">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-[#1A1815]">
            Price Range
          </p>
          {(minPrice > ABS_MIN || maxPrice < ABS_MAX) && (
            <button
              onClick={() => {
                setMinPrice(ABS_MIN);
                setMaxPrice(ABS_MAX);
              }}
              className="text-[10px] text-[#B4593F] hover:underline flex items-center gap-0.5"
            >
              <RotateCcw size={10} /> Reset
            </button>
          )}
        </div>

        {/* Price distribution */}
        <div className="h-10 flex items-end gap-[3px] px-0.5 mb-2" aria-hidden="true">
          {priceBuckets.map((count, index) => {
            const lower = ABS_MIN + (priceSpan * index) / priceBuckets.length;
            const upper = ABS_MIN + (priceSpan * (index + 1)) / priceBuckets.length;
            const inRange = upper >= minPrice && lower <= maxPrice;
            const barHeight = count === 0 ? 3 : Math.max(6, (count / maxPriceBucket) * 38);
            return (
              <div
                key={index}
                className="flex-1 rounded-t-[3px] transition-all duration-200"
                style={{ height: `${barHeight}px`, backgroundColor: inRange ? "#1A1815" : "#DBD5C7", opacity: count === 0 ? 0.55 : 1 }}
              />
            );
          })}
        </div>
        {/* Inputs */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8A8377] font-medium">
              ৳
            </span>
            <input
              type="number"
              value={minPrice === 0 ? "" : minPrice}
              min={0}
              max={maxPrice}
              onChange={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                setMinPrice(Math.max(0, val));
              }}
              className="w-full text-[12px] font-medium text-[#1A1815] bg-[#FFFFFF] border border-[#DBD5C7] rounded-[4px] pl-6 pr-2 py-1.5 focus:outline-none focus:border-[#A67C3D]"
              placeholder={String(ABS_MIN)}
            />
          </div>
          <span className="text-[#8A8377] text-[12px] font-medium">–</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8A8377] font-medium">
              ৳
            </span>
            <input
              type="number"
              value={maxPrice === ABS_MAX ? "" : maxPrice}
              min={minPrice}
              max={ABS_MAX}
              onChange={(e) => {
                const val = e.target.value === "" ? ABS_MAX : Number(e.target.value);
                setMaxPrice(Math.min(ABS_MAX, val));
              }}
              className="w-full text-[12px] font-medium text-[#1A1815] bg-[#FFFFFF] border border-[#DBD5C7] rounded-[4px] pl-6 pr-2 py-1.5 focus:outline-none focus:border-[#A67C3D]"
              placeholder={String(ABS_MAX)}
            />
          </div>
        </div>

        {/* Dual-handle price range */}
        <div
          className="price-range-track relative h-5 mb-1.5 mx-1"
          style={{
            background: `linear-gradient(to right, #DBD5C7 ${((minPrice - ABS_MIN) / priceSpan) * 100}%, #1A1815 ${((minPrice - ABS_MIN) / priceSpan) * 100}%, #1A1815 ${((maxPrice - ABS_MIN) / priceSpan) * 100}%, #DBD5C7 ${((maxPrice - ABS_MIN) / priceSpan) * 100}%)`,
          }}
        >
          <input
            aria-label="Minimum price"
            type="range"
            min={ABS_MIN}
            max={Math.max(ABS_MIN + 50, maxPrice - 50)}
            step={50}
            value={minPrice}
            onChange={(e) => setMinPrice(Math.min(maxPrice - 50, Number(e.target.value)))}
            className="price-range-input price-range-min"
          />
          <input
            aria-label="Maximum price"
            type="range"
            min={Math.min(ABS_MAX - 50, minPrice + 50)}
            max={ABS_MAX}
            step={50}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Math.max(minPrice + 50, Number(e.target.value)))}
            className="price-range-input price-range-max"
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-[#8A8377] mb-3.5">
          <span>&#2547;{minPrice.toLocaleString()}</span>
          <span>&#2547;{maxPrice.toLocaleString()}</span>
        </div>
        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "All", min: ABS_MIN, max: ABS_MAX },
            { label: "< ৳500", min: ABS_MIN, max: 500 },
            { label: "৳500–৳1.5k", min: 500, max: 1500 },
            { label: "৳1.5k+", min: 1500, max: ABS_MAX },
          ].map((p) => {
            const isActive = minPrice === p.min && maxPrice === p.max;
            return (
              <button
                key={p.label}
                onClick={() => {
                  setMinPrice(p.min);
                  setMaxPrice(p.max);
                }}
                className={`text-[10px] px-2 py-1 rounded border transition-all ${
                  isActive
                    ? "bg-[#1A1815] text-[#FFFFFF] border-[#1A1815] font-medium"
                    : "bg-transparent text-[#4A463F] border-[#DBD5C7] hover:border-[#1A1815]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Material Filter */}
      <div className="pb-6 border-b border-[#DBD5C7]">
        <p className="text-[11px] font-semibold tracking-wider uppercase text-[#1A1815] mb-3.5">
          Material
        </p>
        <div className="space-y-2">
          {materialOptions.map((opt) => {
            const cnt = getMaterialCount(opt.id);
            const isChecked = selectedMaterials.includes(opt.id);
            return (
              <label
                key={opt.id}
                onClick={() => toggleMaterial(opt.id)}
                className={`flex items-center justify-between cursor-pointer py-1 px-2 rounded-md transition-colors ${
                  isChecked ? "bg-[#EDE3D0]/60 font-medium" : "hover:bg-[#FFFFFF]/50"
                } ${cnt === 0 ? "opacity-45 pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isChecked
                        ? "bg-[#1A1815] border-[#1A1815] text-[#FFFFFF]"
                        : "border-[#B9B1A0] bg-white"
                    }`}
                  >
                    {isChecked && <Check size={11} strokeWidth={3} />}
                  </div>
                  <span className="text-[13px] text-[#1A1815]">{opt.label}</span>
                </div>
                <span className="text-[11px] font-mono text-[#8A8377]">({cnt})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Color Filter */}
      <div className="pb-4">
        <p className="text-[11px] font-semibold tracking-wider uppercase text-[#1A1815] mb-3.5">
          Colour Palette
        </p>
        <div className="space-y-2">
          {colorOptions.map((opt) => {
            const cnt = getColorCount(opt.id);
            const isChecked = selectedColors.includes(opt.id);
            return (
              <label
                key={opt.id}
                onClick={() => toggleColor(opt.id)}
                className={`flex items-center justify-between cursor-pointer py-1 px-2 rounded-md transition-colors ${
                  isChecked ? "bg-[#EDE3D0]/60 font-medium" : "hover:bg-[#FFFFFF]/50"
                } ${cnt === 0 ? "opacity-45 pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded-full border border-black/20 shrink-0 shadow-sm"
                    style={{ backgroundColor: opt.hex }}
                  />
                  <span className="text-[13px] text-[#1A1815]">{opt.label}</span>
                </div>
                <span className="text-[11px] font-mono text-[#8A8377]">({cnt})</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header Banner */}
      <div className="max-w-[1800px] mx-auto px-8 py-10 border-b border-[#DBD5C7]">
        <div className="flex items-center gap-2 text-[11px] text-[#8A8377] mb-4">
          <button onClick={() => navigate("home")} className="hover:text-[#1A1815] transition-colors">
            Home
          </button>
          <span>/</span>
          <span className="text-[#4A463F]">{catLabel}</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1
              className="text-[38px] md:text-[44px] font-light text-[#1A1815]"
              style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em" }}
            >
              {catLabel}
            </h1>
            <p className="text-[13px] text-[#8A8377] mt-1">
              Thoughtful lighting and objects for everyday living
            </p>
          </div>
          <p className="text-[13px] font-medium text-[#1A1815] mb-1.5 hidden sm:block">
            Showing {sorted.length} {sorted.length === 1 ? "piece" : "pieces"}
          </p>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-8 py-8">
        {/* Category Pill Bar & Controls */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {[{ label: "All", slug: "all" }, ...CATEGORIES.slice(0, 5)].map((c) => {
              const isSelected = cat === ("slug" in c ? c.slug : "all");
              return (
                <button
                  key={"slug" in c ? c.slug : "all"}
                  onClick={() => navigate("listing", { category: "slug" in c ? c.slug : "all" })}
                  className="shrink-0 text-[10px] font-medium tracking-widest uppercase px-4 py-2 rounded-full border transition-all duration-200 whitespace-nowrap"
                  style={{
                    borderColor: isSelected ? "#1A1815" : "#DBD5C7",
                    backgroundColor: isSelected ? "#1A1815" : "transparent",
                    color: isSelected ? "#FFFFFF" : "#4A463F",
                  }}
                >
                  {"name" in c ? c.name : "All"}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Mobile Filter Trigger */}
            <button
              onClick={openMobileFilters}
              className="lg:hidden inline-flex items-center gap-2 text-[12px] font-medium text-[#1A1815] bg-[#FFFFFF] border border-[#DBD5C7] rounded-[4px] px-3.5 py-2 hover:bg-[#FFFFFF] transition-colors"
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#1A1815] text-[#FFFFFF] text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-[12px] font-medium text-[#4A463F] bg-[#FFFFFF] border border-[#DBD5C7] rounded-[4px] px-3 py-2 focus:outline-none focus:border-[#A67C3D] cursor-pointer"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="newest">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {activeFilterCount > 0 && (
          <div className="flex items-center flex-wrap gap-2 mb-8 p-3.5 bg-[#FFFFFF] border border-[#DBD5C7] rounded-md transition-all">
            <span className="font-semibold text-[#1A1815] uppercase text-[10px] tracking-wider mr-1">
              Active Filters:
            </span>

            {selectedBadges.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 bg-[#EDE3D0] text-[#1A1815] text-[11px] font-medium px-3 py-1 rounded-full border border-[#B9B1A0]"
              >
                {BADGE_OPTIONS.find((o) => o.id === id)?.label}
                <button
                  onClick={() => toggleBadge(id)}
                  className="hover:text-[#B4593F] transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {selectedMaterials.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 bg-[#EDE3D0] text-[#1A1815] text-[11px] font-medium px-3 py-1 rounded-full border border-[#B9B1A0]"
              >
                Material: {id}
                <button
                  onClick={() => toggleMaterial(id)}
                  className="hover:text-[#B4593F] transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {selectedColors.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 bg-[#EDE3D0] text-[#1A1815] text-[11px] font-medium px-3 py-1 rounded-full border border-[#B9B1A0]"
              >
                Colour: {id}
                <button
                  onClick={() => toggleColor(id)}
                  className="hover:text-[#B4593F] transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {(minPrice > ABS_MIN || maxPrice < ABS_MAX) && (
              <span className="inline-flex items-center gap-1.5 bg-[#EDE3D0] text-[#1A1815] text-[11px] font-medium px-3 py-1 rounded-full border border-[#B9B1A0]">
                Price: ৳{minPrice.toLocaleString()} – ৳{maxPrice.toLocaleString()}
                <button
                  onClick={() => {
                    setMinPrice(ABS_MIN);
                    setMaxPrice(ABS_MAX);
                  }}
                  className="hover:text-[#B4593F] transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              onClick={resetAllFilters}
              className="text-[11px] font-semibold text-[#B4593F] hover:underline ml-auto flex items-center gap-1 py-1"
            >
              <RotateCcw size={12} /> Clear All
            </button>
          </div>
        )}

        <div className="flex gap-10 items-start">
          {/* Desktop Filter Sidebar Rail */}
          <aside className="hidden lg:block w-60 shrink-0 sticky top-[88px] max-h-[calc(100vh-100px)] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin" }}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#DBD5C7]">
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#1A1815]">
                Filter Collection
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="text-[11px] font-medium text-[#B4593F] hover:underline"
                >
                  Reset ({activeFilterCount})
                </button>
              )}
            </div>

            {renderFilterSidebar()}
          </aside>

          {/* Product Grid Area */}
          <div className="flex-1 min-w-0">
            {sorted.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10">
                {sorted.flatMap((p, i) => {
                  const cards = [<ProductCard key={p.id} product={p} />];
                  if ((i + 1) % 9 === 0) {
                    cards.push(
                      <div
                        key={`custom-${i}`}
                        className="bg-[#1A1815] rounded-lg p-7 flex flex-col justify-between"
                        style={{ minHeight: 320 }}
                      >
                        <div>
                          <p className="text-[10px] font-medium tracking-widest uppercase text-[#A67C3D] mb-4">
                            Bespoke
                          </p>
                          <h3
                            className="text-[20px] font-light text-[#FFFFFF] mb-3 leading-snug"
                            style={{ fontFamily: "'Fraunces', serif" }}
                          >
                            Looking for something custom?
                          </h3>
                          <p className="text-[12px] text-[#FFFFFF]/55 leading-relaxed">
                            Any dimension, any material. Ask us for a pairing.
                          </p>
                        </div>
                        <button className="mt-5 inline-flex items-center gap-2 text-[10px] font-medium tracking-widest uppercase text-[#FFFFFF] border border-[#FFFFFF]/25 px-4 py-2.5 rounded-[4px] hover:border-[#FFFFFF]/55 transition-colors self-start">
                          Start a request <ArrowRight size={11} />
                        </button>
                      </div>
                    );
                  }
                  return cards;
                })}
              </div>
            ) : (
              <div className="py-24 px-6 text-center bg-[#FFFFFF] border border-[#DBD5C7] rounded-lg">
                <Filter size={32} className="mx-auto text-[#8A8377] mb-3 opacity-60" />
                <h3
                  className="text-[22px] font-light text-[#1A1815] mb-2"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  No pieces match your exact criteria
                </h3>
                <p className="text-[13px] text-[#8A8377] mb-6 max-w-md mx-auto">
                  Try broadening your price range, clearing selected materials or color swatches to view more options.
                </p>
                <button
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-2 text-[11px] font-medium tracking-widest uppercase bg-[#1A1815] text-[#FFFFFF] px-6 py-3 rounded-[4px] hover:bg-[#2E2A24] transition-colors"
                >
                  <RotateCcw size={12} /> Reset All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div className={`fixed inset-0 z-[200] flex lg:hidden ${mobileFilterClosing ? "mobile-filter-overlay-closing" : "mobile-filter-overlay-opening"}`}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/25"
            style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
            onClick={closeMobileFilters}
          />
          {/* Drawer content */}
          <section role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title" className={`mobile-filter-drawer relative flex h-full min-h-0 w-80 max-w-[88vw] flex-col overflow-hidden bg-[#FFFFFF] shadow-[16px_0_48px_rgba(0,0,0,0.35)] ${mobileFilterClosing ? "mobile-filter-drawer-closing" : "mobile-filter-drawer-opening"}`}>
            <div className="flex shrink-0 items-center justify-between border-b border-[#DBD5C7] p-5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={17} className="text-[#1A1815]" />
                <h3 id="mobile-filter-title" className="text-[15px] font-medium text-[#1A1815]" style={{ fontFamily: "'Cinzel Decorative', serif", letterSpacing: "0.08em" }}>
                  Filters
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close filters"
                onClick={closeMobileFilters}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#4A463F] transition hover:bg-[#FFFFFF]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3" style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>{renderFilterSidebar()}</div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#DBD5C7] bg-[#FFFFFF] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex min-h-11 items-center justify-center rounded-[4px] border border-[#DBD5C7] bg-transparent px-3 text-[10px] font-medium tracking-[0.16em] text-[#1A1815] transition-colors hover:bg-[#FFFFFF]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={closeMobileFilters}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-[4px] bg-[#1A1815] px-3 text-[10px] font-medium tracking-[0.12em] text-[#FFFFFF] transition-colors hover:bg-[#2E2A24]"
              >
                Apply ({sorted.length})
              </button>
            </div>
          </section>
        </div>
      )}

      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT PAGE (PDP)
// ─────────────────────────────────────────────────────────────────────────────

function ProductPage({ params }: { params?: Record<string, string> }) {
  const { navigate, addToCart, closeMiniCart, toggleWishlist, wishlist, user, authReady, products } = useApp();
  const matchingProduct = products.find((p) => p.id === params?.id);
  const product = matchingProduct || products[0] || PRODUCTS[0];

  const [selectedSize, setSelectedSize] = useState(product.sizes?.[1]?.label ?? product.sizes?.[0]?.label);
  const [selectedFabric, setSelectedFabric] = useState(product.fabrics?.[0]?.label);
  const [selectedLeg, setSelectedLeg] = useState(product.legs?.[0]?.label);
  const [colorIdx, setColorIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("description");
  const [shareMessage, setShareMessage] = useState("");
  const [productReviews, setProductReviews] = useState<CustomerReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  useEffect(() => {
    let active = true;
    setReviewsLoading(true);
    fetch(`/api/reviews?product=${encodeURIComponent(product.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Reviews are unavailable.");
        return result as { reviews: CustomerReview[] };
      })
      .then((result) => { if (active) { setProductReviews(result.reviews); setReviewsError(""); } })
      .catch((error: unknown) => { if (active) setReviewsError(error instanceof Error ? error.message : "Reviews are unavailable."); })
      .finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, [product.id]);
  if (!matchingProduct) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 text-3xl font-light text-[#1A1815]" style={{ fontFamily: "'Fraunces', serif" }}>Product not found</h1>
        <p className="mb-7 text-sm text-[#8A8377]">We couldn’t find that piece in the collection.</p>
        <button onClick={() => navigate("listing")} className="bg-[#1A1815] px-6 py-3 text-[11px] font-medium uppercase tracking-widest text-white hover:bg-[#2E2A24]">
          Browse the collection
        </button>
      </section>
    );
  }
  const dimensionRows = product.dimensions
    ? [["Dimensions", product.dimensions]]
    : product.category === "Mirrors"
    ? [["Width", "60 cm"], ["Depth", "4 cm"], ["Height", "90 cm"], ["Frame", "Brushed finish"], ["Weight", "6.5 kg"]]
    : product.category === "Tables"
      ? [["Width", "55 cm"], ["Depth", "45 cm"], ["Height", "52 cm"], ["Top", "Solid surface"], ["Weight", "8 kg"]]
      : product.category === "Shades"
        ? [["Diameter", "30 cm"], ["Height", "22 cm"], ["Fitter", "Standard ring"], ["Fabric", "Linen or cotton"], ["Weight", "0.5 kg"]]
        : [["Width", "28 cm"], ["Depth", "28 cm"], ["Height", "46 cm"], ["Shade", "26 cm diameter"], ["Weight", "2.8 kg"]];
  const materialRows = product.materials?.length
    ? [["Materials", product.materials.join(", ")], ["Finish", "Hand-finished surface"], ["Care", "Wipe with a soft dry cloth"], ["Warranty", "1-year quality cover"]]
    : product.category === "Mirrors"
    ? [["Mirror", "Clear polished glass"], ["Frame", "Brass or solid wood"], ["Mounting", "Wall-ready fittings"], ["Care", "Clean with a soft cloth"], ["Warranty", "1-year quality cover"]]
    : product.category === "Tables"
      ? [["Materials", "Solid wood, marble, or metal"], ["Finish", "Hand-finished surface"], ["Assembly", "Simple home assembly"], ["Care", "Wipe with a soft dry cloth"], ["Warranty", "1-year quality cover"]]
      : product.category === "Shades"
        ? [["Fabric", "Linen, cotton, or velvet"], ["Lining", "Softly diffusing"], ["Fitter", "Standard lamp fitting"], ["Care", "Dust with a soft brush"], ["Warranty", "1-year quality cover"]]
        : [["Materials", "Glass, brass, ceramic, and linen"], ["Finish", "Hand-finished surface"], ["Light", "Warm ambient glow"], ["Care", "Dust with a soft dry cloth"], ["Warranty", "1-year quality cover"]];

  const galleryImages = product.gallery?.length ? product.gallery : [product.images.silo, product.images.lifestyle, product.images.silo, product.images.lifestyle];
  const selectedColorImage = product.swatches[colorIdx]?.imageUrl;
  const mockImages = selectedColorImage
    ? [selectedColorImage, ...galleryImages.filter((image) => image !== selectedColorImage)]
    : galleryImages;
  const basePrice = product.salePrice ?? product.basePrice;
  const currentPrice = resolvePrice(product, selectedSize, selectedFabric);

  const legDelta = selectedLeg && product.legs ? (product.legs.find((l) => l.label === selectedLeg)?.delta ?? 0) : 0;
  const totalPrice = currentPrice + legDelta;
  const isWished = wishlist.includes(product.id);

  const selectedOptions = {
    size: selectedSize,
    color: product.swatches[colorIdx]?.label,
    fabric: selectedFabric,
    legFinish: selectedLeg,
    quantity,
    price: totalPrice,
  };
  const addSelectedToCart = () => addToCart(product, selectedOptions);
  const buySelectedNow = () => {
    addToCart(product, selectedOptions);
    closeMiniCart();
    navigate("checkout");
  };
  const shareProduct = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: product.description, url });
        setShareMessage("Product shared");
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("Product link copied");
    } catch {
      setShareMessage("Sharing is unavailable in this browser");
    }
  };

  const breakdown: { label: string; value: number; prefix?: string }[] = [
    { label: `${product.name} (base)`, value: basePrice },
  ];
  if (selectedSize && product.sizes) {
    const s = product.sizes.find((x) => x.label === selectedSize);
    if (s && s.delta !== 0) breakdown.push({ label: `${selectedSize} size`, value: s.delta, prefix: "+" });
  }
  if (selectedFabric && product.fabrics) {
    const f = product.fabrics.find((x) => x.label === selectedFabric);
    if (f && f.delta !== 0) breakdown.push({ label: `${selectedFabric} fabric`, value: f.delta, prefix: "+" });
  }
  if (legDelta !== 0) breakdown.push({ label: `${selectedLeg} leg finish`, value: legDelta, prefix: "+" });

  return (
    <div>
      <div className="max-w-[1800px] mx-auto px-8 py-4">
        <div className="flex items-center gap-2 text-[11px] text-[#8A8377]">
          {[
            { label: "Home", action: () => navigate("home") },
            { label: product.category, action: () => navigate("listing", { category: product.category.toLowerCase().replace(/ /g, "-") }) },
            { label: product.subcategory, action: () => navigate("listing", { category: product.category.toLowerCase().replace(/ /g, "-") }) },
          ].flatMap(({ label, action }, i) => [
            ...(i > 0 ? [<span key={`sep-${i}`}>/</span>] : []),
            <button key={label} onClick={action} className="hover:text-[#1A1815] transition-colors">{label}</button>,
          ])}
          <span>/</span>
          <span className="text-[#4A463F]">{product.name}</span>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20">

          {/* Gallery */}
          <div className="lg:sticky lg:top-[88px] self-start">
            <div
              className="relative rounded-lg overflow-hidden bg-[#FFFFFF] mb-4"
              style={{ aspectRatio: "4/5" }}
            >
              <img src={mockImages[imgIdx]} alt={product.name} className="h-full w-full scale-[1.08] object-cover transition-opacity duration-300" />
              {imgIdx > 0 && (
                <button
                  onClick={() => setImgIdx((i) => i - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/85 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors"
                >
                  <ChevronLeft size={16} className="text-[#1A1815]" />
                </button>
              )}
              {imgIdx < mockImages.length - 1 && (
                <button
                  onClick={() => setImgIdx((i) => i + 1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/85 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors"
                >
                  <ChevronRight size={16} className="text-[#1A1815]" />
                </button>
              )}
              <div className="absolute bottom-3 right-3 bg-black/30 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-sm">
                {imgIdx + 1}/{mockImages.length}
              </div>
            </div>
            <div className="flex gap-3">
              {mockImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className="overflow-hidden rounded-lg transition-all duration-200"
                  style={{
                    width: 68, height: 80,
                    opacity: imgIdx === i ? 1 : 0.45,
                    outline: imgIdx === i ? "2px solid #1A1815" : "2px solid transparent",
                    outlineOffset: 2,
                  }}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Config */}
          <div>
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {product.badge && <BadgeTag type={product.badge} />}
              {product.orderType === "made-to-order" && (
                <span className="text-[10px] font-medium tracking-widest uppercase bg-[#F1E6CF] text-[#B07C2E] px-2 py-1 rounded-[4px]">
                  IN PRODUCTION · {(product.leadTime ?? "6-wk").toUpperCase()} LEAD
                </span>
              )}
            </div>

            <p className="text-[10px] font-medium tracking-widest uppercase text-[#8A8377] mb-2">{product.subcategory}</p>
            <h1
              className="text-[32px] md:text-[38px] font-light text-[#1A1815] mb-3 leading-tight"
              style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em" }}
            >
              {product.name}
            </h1>

            {productReviews.length > 0 && (
              <div className="flex items-center gap-2 mb-5">
                <Stars value={productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length} />
                <span className="text-[12px] text-[#8A8377]">{(productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length).toFixed(1)} ({productReviews.length} reviews)</span>
              </div>
            )}

            <p className="mb-5 flex items-center gap-2 text-xs text-[#4A463F]">
              <span className="h-2 w-2 rounded-full bg-[#6F7D5E]" />
              {product.orderType === "in-stock" ? "Available to order" : `Made to order${product.leadTime ? ` · ${product.leadTime} lead time` : ""}`}
            </p>
            {product.dimensions && <p className="-mt-3 mb-5 text-xs text-[#8A8377]">Dimensions: {product.dimensions}</p>}

            <div className="h-px bg-[#DBD5C7] mb-6" />

            {/* Size */}
            {product.sizes && (
              <div className="mb-6">
                <p className="text-[10px] font-medium tracking-widest uppercase text-[#4A463F] mb-3">Size</p>
                <div className="grid grid-cols-2 gap-2">
                  {product.sizes.map((sz) => (
                    <button
                      key={sz.label}
                      onClick={() => setSelectedSize(sz.label)}
                      className="px-4 py-3 rounded-[4px] border text-left transition-all duration-150"
                      style={{
                        borderColor: selectedSize === sz.label ? "#1A1815" : "#DBD5C7",
                        backgroundColor: selectedSize === sz.label ? "#FFFFFF" : "transparent",
                      }}
                    >
                      <p className="text-[12px] font-semibold text-[#1A1815]">{sz.label}</p>
                      <p className="text-[11px] text-[#8A8377]">
                        {sz.delta === 0
                          ? `From ${formatPrice(basePrice)}`
                          : sz.delta > 0
                          ? `+${formatPrice(sz.delta)}`
                          : formatPrice(basePrice + sz.delta)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colour */}
            {product.swatches.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-medium tracking-widest uppercase text-[#4A463F]">Colour</p>
                  <p className="text-[12px] text-[#4A463F]">{product.swatches[colorIdx].label}</p>
                </div>
                <div className="flex gap-2.5">
                  {product.swatches.map((sw, i) => (
                    <button
                      key={sw.label}
                      onClick={() => { setColorIdx(i); setImgIdx(0); }}
                      aria-label={`Colour: ${sw.label}`}
                      className="rounded-full border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A67C3D]"
                      style={{
                        width: 26, height: 26, backgroundColor: sw.color,
                        borderColor: colorIdx === i ? "#1A1815" : "#DBD5C7",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Fabric */}
            {product.fabrics && (
              <div className="mb-6">
                <p className="text-[10px] font-medium tracking-widest uppercase text-[#4A463F] mb-3">Fabric</p>
                <div className="flex flex-wrap gap-2">
                  {product.fabrics.map((f) => (
                    <button
                      key={f.label}
                      onClick={() => setSelectedFabric(f.label)}
                      className="px-4 py-2 rounded-[4px] border text-[12px] transition-all duration-150"
                      style={{
                        borderColor: selectedFabric === f.label ? "#1A1815" : "#DBD5C7",
                        backgroundColor: selectedFabric === f.label ? "#1A1815" : "transparent",
                        color: selectedFabric === f.label ? "#FFFFFF" : "#4A463F",
                      }}
                    >
                      {f.label}
                      {f.delta > 0 && <span className="ml-1 opacity-55 text-[10px]">+{formatPrice(f.delta)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Leg finish */}
            {product.legs && (
              <div className="mb-6">
                <p className="text-[10px] font-medium tracking-widest uppercase text-[#4A463F] mb-3">Leg Finish</p>
                <div className="flex flex-wrap gap-2">
                  {product.legs.map((l) => (
                    <button
                      key={l.label}
                      onClick={() => setSelectedLeg(l.label)}
                      className="px-4 py-2 rounded-[4px] border text-[12px] transition-all duration-150"
                      style={{
                        borderColor: selectedLeg === l.label ? "#1A1815" : "#DBD5C7",
                        backgroundColor: selectedLeg === l.label ? "#1A1815" : "transparent",
                        color: selectedLeg === l.label ? "#FFFFFF" : "#4A463F",
                      }}
                    >
                      {l.label}
                      {l.delta > 0 && <span className="ml-1 opacity-55 text-[10px]">+{formatPrice(l.delta)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="h-px bg-[#DBD5C7] mb-6" />

            {/* Price + breakdown */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3 mb-4">
                <span
                  className="text-[34px] font-light text-[#1A1815]"
                  style={{ fontFamily: "'Fraunces', serif", fontVariantNumeric: "tabular-nums" }}
                >
                  {formatPrice(totalPrice)}
                </span>
                {product.orderType === "made-to-order" && (
                  <span className="text-[12px] text-[#8A8377]">{product.leadTime} lead · free delivery</span>
                )}
              </div>

              {breakdown.length > 1 && (
                <div className="bg-[#FFFFFF] border border-[#DBD5C7] rounded-[4px] p-4 space-y-2.5">
                  {breakdown.map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      <span className="text-[#4A463F]">{line.label}</span>
                      <span className="text-[#1A1815]">{line.prefix}{formatPrice(line.value)}</span>
                    </div>
                  ))}
                  <div className="h-px bg-[#DBD5C7]" />
                  <div className="flex items-center justify-between text-[11px] font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    <span className="text-[#1A1815]">Total</span>
                    <span className="text-[#1A1815]">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quantity and purchase actions */}
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_48px] sm:gap-3">
              <div className="col-start-1 row-start-1 flex h-12 w-fit items-center rounded border border-[#DBD5C7] bg-white" role="group" aria-label="Quantity">
                <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="flex h-full w-9 items-center justify-center text-[#4A463F] transition-colors hover:text-[#A67C3D] disabled:cursor-not-allowed disabled:opacity-40"><Minus size={14} /></button>
                <span aria-live="polite" className="min-w-7 text-center text-sm tabular-nums text-[#1A1815]">{quantity}</span>
                <button type="button" aria-label="Increase quantity" disabled={quantity >= 99} onClick={() => setQuantity((value) => Math.min(99, value + 1))} className="flex h-full w-9 items-center justify-center text-[#4A463F] transition-colors hover:text-[#A67C3D] disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} /></button>
              </div>
              <button type="button" onClick={addSelectedToCart} className="col-span-2 row-start-2 min-h-12 rounded bg-[#1A1815] px-3 text-[10px] font-medium uppercase tracking-wider text-[#FFFFFF] transition-colors hover:bg-[#2E2A24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A67C3D] sm:col-span-1 sm:row-auto sm:text-[11px]">
                Add to cart
              </button>
              <button type="button" onClick={buySelectedNow} className="col-span-2 row-start-3 min-h-12 rounded border border-[#1A1815] bg-white px-3 text-[10px] font-medium uppercase tracking-wider text-[#1A1815] transition-colors hover:bg-[#F1E6CF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A67C3D] sm:col-span-1 sm:row-auto sm:text-[11px]">
                Buy now
              </button>
              <button type="button" onClick={() => toggleWishlist(product.id)} aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={isWished} className="col-start-2 row-start-1 flex h-12 w-12 justify-self-end items-center justify-center rounded-full border border-[#DBD5C7] text-[#4A463F] transition-colors hover:border-[#B9B1A0] hover:bg-[#FFFFFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A67C3D] sm:col-auto sm:row-auto">
                <Heart size={18} strokeWidth={1.5} className={isWished ? "fill-[#B4593F] text-[#B4593F]" : ""} />
              </button>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-[#DBD5C7] pb-5">
              <button type="button" onClick={shareProduct} className="inline-flex items-center gap-2 text-xs font-medium text-[#6B6257] transition-colors hover:text-[#A67C3D] focus-visible:outline-none focus-visible:underline"><Share2 size={14} /> Share product</button>
              <span aria-live="polite" className="text-xs text-[#6F7D5E]">{shareMessage}</span>
            </div>

            <details className="group mb-5 border-b border-[#DBD5C7] pb-4">
              <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-medium text-[#4A463F]">Details <span className="text-lg font-light transition-transform group-open:rotate-45">+</span></summary>
              <div className="space-y-3 pt-4 text-[13px] leading-relaxed text-[#6B6257]">
                <p>{product.description}</p>
                <p><span className="font-medium text-[#4A463F]">Category:</span> {product.category} · {product.subcategory}</p>
                <p><span className="font-medium text-[#4A463F]">Availability:</span> {product.orderType === "in-stock" ? "Available to order" : `Made to order${product.leadTime ? ` · ${product.leadTime} lead time` : ""}`}</p>
              </div>
            </details>

            {/* Assurances */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {["30-day returns", "1-year warranty", "Free delivery", "Easy setup"].map((a) => (
                <div key={a} className="flex items-center gap-2 text-[11px] text-[#4A463F]">
                  <Check size={11} className="text-[#6F7D5E] shrink-0" />
                  {a}
                </div>
              ))}
            </div>

            <p className="text-[12px] text-[#8A8377]">
              Looking for another finish or shade?{" "}
              <button className="text-[#A67C3D] hover:text-[#6B4B32] transition-colors underline underline-offset-2">
                Ask about available options →
              </button>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-20 border-t border-[#DBD5C7] pt-12">
          <div className="flex gap-8 border-b border-[#DBD5C7] mb-8 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {["description", "dimensions", "materials", "shipping"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-[10px] font-medium tracking-widest uppercase pb-4 border-b-2 transition-all duration-200 capitalize shrink-0"
                style={{
                  borderColor: tab === t ? "#A67C3D" : "transparent",
                  color: tab === t ? "#1A1815" : "#8A8377",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="max-w-2xl">
            {tab === "description" && (
              <div className="space-y-4">
                <p className="text-[15px] text-[#4A463F] leading-relaxed">{product.description}</p>
                <p className="text-[15px] text-[#4A463F] leading-relaxed">
                  Thoughtful proportions, durable finishes, and carefully selected glass, metal, linen, and wood give each piece its distinctive character.
                </p>
              </div>
            )}
            {tab === "dimensions" && (
              <div>
                {dimensionRows.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-3.5 border-b border-[#DBD5C7]">
                    <span className="text-[12px] text-[#8A8377] font-medium">{k}</span>
                    <span className="text-[13px] text-[#1A1815]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === "materials" && (
              <div>
                {materialRows.map(([k, v]) => (
                  <div key={k} className="py-3.5 border-b border-[#DBD5C7]">
                    <p className="text-[10px] font-medium tracking-widest uppercase text-[#8A8377] mb-1">{k}</p>
                    <p className="text-[13px] text-[#4A463F]">{v}</p>
                  </div>
                ))}
              </div>
            )}
            {tab === "shipping" && (
              <div className="space-y-5">
                <p className="text-[14px] text-[#4A463F] leading-relaxed">
                  Complimentary standard delivery on orders over ৳15,000. Lamps and mirrors are packed carefully for a safe arrival.
                </p>
                <p className="text-[14px] text-[#4A463F] leading-relaxed">
                  In-stock pieces usually dispatch within 2–4 business days. Returns are accepted within 30 days of delivery.
                </p>
                {product.orderType === "made-to-order" && (
                  <div className="bg-[#F1E6CF] rounded-[4px] p-4">
                    <p className="text-[12px] font-semibold text-[#B07C2E] mb-1">Ready to ship · {product.leadTime} lead time</p>
                    <p className="text-[12px] text-[#8A6020]">Pay 30% now, balance on delivery confirmation.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <CustomerReviews
          product={product}
          reviews={productReviews}
          loading={reviewsLoading}
          error={reviewsError}
          user={user}
          authReady={authReady}
          navigate={navigate}
        />

        {/* Related */}
        <div className="mt-20">
          <h2
            className="text-[26px] font-light text-[#1A1815] mb-10"
            style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em" }}
          >
            You may also like
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
            {[...products.filter((p) => p.id !== product.id && p.category === product.category), ...products.filter((p) => p.id !== product.id && p.category !== product.category)]
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </div>
      </div>

      <PreFooterCTA />
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKOUT PAGE
// ─────────────────────────────────────────────────────────────────────────────

function CheckoutPage() {
  const { cart, cartSubtotal, navigate } = useApp();
  const [done, setDone] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bkash" | "cod">("card");
  const [details, setDetails] = useState({ name: "", email: "", address: "", city: "", postalCode: "", phone: "", bkashNumber: "" });
  const orderId = useRef("MN-" + Math.floor(Math.random() * 90000 + 10000));
  // Prices in this storefront are stored in paisa and formatted as taka.
  const deliveryFee = deliveryMethod === "express" ? 150000 : 0;
  const orderTotal = cartSubtotal + deliveryFee;
  const updateDetail = (field: keyof typeof details, value: string) => setDetails((current) => ({ ...current, [field]: value }));
  const inputClass = "w-full rounded border border-[#DBD5C7] bg-white px-4 py-3 text-sm text-[#1A1815] placeholder:text-[#9A9388] transition-colors focus:border-[#A67C3D] focus:outline-none focus:ring-2 focus:ring-[#A67C3D]/15";
  const sectionTitle = "mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#4A463F]";
  const choiceClass = (selected: boolean) => `flex w-full cursor-pointer items-start gap-3 rounded border p-4 transition-colors ${selected ? "border-[#A67C3D] bg-[#FFFFFF]" : "border-[#DBD5C7] bg-white hover:border-[#B9AD98]"}`;

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8 text-center">
        <div className="max-w-md">
          <div className="w-16 h-16 bg-[#E7EADD] rounded-full flex items-center justify-center mx-auto mb-6"><Check size={26} className="text-[#6F7D5E]" /></div>
          <h1 className="text-[30px] font-light text-[#1A1815] mb-3" style={{ fontFamily: "'Fraunces', serif" }}>Order confirmed</h1>
          <p className="text-[13px] text-[#8A8377] mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{orderId.current}</p>
          <p className="text-[14px] text-[#4A463F] mb-8 leading-relaxed">Thank you{details.name ? `, ${details.name}` : ""}. Your order details are ready for {details.email}.</p>
          <p className="mb-7 text-xs leading-5 text-[#8A8377]">Demo checkout only: no payment has been processed and this order has not been sent to a server.</p>
          <button type="button" onClick={() => navigate("home")} className="inline-flex items-center gap-2 bg-[#1A1815] text-[#FFFFFF] text-[11px] font-medium tracking-widest uppercase px-7 py-3.5 rounded-[4px] hover:bg-[#2E2A24] transition-colors">Continue shopping</button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <ShoppingBag size={34} strokeWidth={1} className="mb-5 text-[#B9B1A0]" />
        <h1 className="mb-3 text-3xl font-light text-[#1A1815]" style={{ fontFamily: "'Fraunces', serif" }}>Your bag is empty</h1>
        <p className="mb-7 text-sm text-[#8A8377]">Add something lovely for your home before checking out.</p>
        <button type="button" onClick={() => navigate("listing")} className="bg-[#1A1815] px-6 py-3 text-[11px] font-medium uppercase tracking-widest text-white transition-colors hover:bg-[#2E2A24]">Explore the collection</button>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <div className="mx-auto max-w-[1240px] px-5 py-9 sm:px-8 sm:py-12 lg:px-10">
        <div className="mb-8 border-b border-[#DBD5C7] pb-6 sm:mb-10 sm:pb-8">
          <button type="button" onClick={() => navigate("cart")} className="mb-4 inline-flex items-center gap-2 text-xs text-[#766F65] transition-colors hover:text-[#A67C3D]"><ArrowLeft size={14} /> Back to bag</button>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#A67C3D]">Almost home</p>
          <h1 className="text-4xl font-light text-[#1A1815] sm:text-5xl" style={{ fontFamily: "'Fraunces', serif" }}>Checkout</h1>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); setDone(true); }} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <div className="space-y-8 sm:space-y-10">
            <section className="border-b border-[#DBD5C7] pb-8 sm:pb-10" aria-labelledby="checkout-contact-heading">
              <h2 id="checkout-contact-heading" className={sectionTitle}>1. Contact</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="sr-only">Email address</span><input required autoComplete="email" type="email" value={details.email} onChange={(event) => updateDetail("email", event.target.value)} placeholder="Email address" className={inputClass} /></label>
                <label className="sm:col-span-2"><span className="sr-only">Full name</span><input required autoComplete="name" value={details.name} onChange={(event) => updateDetail("name", event.target.value)} placeholder="Full name" className={inputClass} /></label>
                <label className="sm:col-span-2"><span className="sr-only">Phone number</span><input required autoComplete="tel" type="tel" inputMode="tel" value={details.phone} onChange={(event) => updateDetail("phone", event.target.value)} placeholder="Phone number (e.g. +880 1XXX-XXXXXX)" className={inputClass} /></label>
              </div>
            </section>

            <section className="border-b border-[#DBD5C7] pb-8 sm:pb-10" aria-labelledby="checkout-address-heading">
              <h2 id="checkout-address-heading" className={sectionTitle}>2. Delivery address</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="sr-only">Street address</span><input required autoComplete="street-address" value={details.address} onChange={(event) => updateDetail("address", event.target.value)} placeholder="House, road, area" className={inputClass} /></label>
                <label><span className="sr-only">City</span><input required autoComplete="address-level2" value={details.city} onChange={(event) => updateDetail("city", event.target.value)} placeholder="City" className={inputClass} /></label>
                <label><span className="sr-only">Postal code</span><input required autoComplete="postal-code" inputMode="numeric" value={details.postalCode} onChange={(event) => updateDetail("postalCode", event.target.value)} placeholder="Postal code" className={inputClass} /></label>
                <div className="sm:col-span-2 rounded border border-[#DBD5C7] bg-white px-4 py-3 text-sm text-[#68635B]">Country <span className="float-right font-medium text-[#1A1815]">Bangladesh</span></div>
              </div>
            </section>

            <fieldset className="border-b border-[#DBD5C7] pb-8 sm:pb-10">
              <legend className={sectionTitle}>3. Delivery method</legend>
              <div className="space-y-2.5">
                {([
                  { id: "standard", title: "Standard delivery", detail: "5–10 business days", fee: "Free" },
                  { id: "express", title: "Express delivery", detail: "2–4 business days", fee: formatPrice(150000) },
                ] as const).map((option) => {
                  const selected = deliveryMethod === option.id;
                  return <label key={option.id} className={choiceClass(selected)}>
                    <input className="mt-1 accent-[#A67C3D]" type="radio" name="delivery" value={option.id} checked={selected} onChange={() => setDeliveryMethod(option.id)} />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
                      <span><span className="block text-sm font-medium text-[#1A1815]">{option.title}</span><span className="mt-1 block text-xs text-[#8A8377]">{option.detail}</span></span>
                      <span className="shrink-0 text-sm font-medium text-[#4A463F]">{option.fee}</span>
                    </span>
                  </label>;
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className={sectionTitle}>4. Payment</legend>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {([
                  { id: "card", label: "Credit / debit card" },
                  { id: "bkash", label: "bKash" },
                  { id: "cod", label: "Cash on delivery" },
                ] as const).map((option) => {
                  const selected = paymentMethod === option.id;
                  return <label key={option.id} className={`${choiceClass(selected)} items-center p-3`}>
                    <input className="accent-[#A67C3D]" type="radio" name="payment" value={option.id} checked={selected} onChange={() => setPaymentMethod(option.id)} />
                    <span className="text-xs font-medium text-[#1A1815]">{option.label}</span>
                  </label>;
                })}
              </div>
              {paymentMethod === "bkash" && <label className="mt-3 block"><span className="sr-only">bKash account phone number</span><input required autoComplete="tel" type="tel" inputMode="tel" value={details.bkashNumber} onChange={(event) => updateDetail("bkashNumber", event.target.value)} placeholder="bKash account phone number" className={inputClass} /></label>}
              <p className="mt-3 text-xs leading-5 text-[#8A8377]">{paymentMethod === "cod" ? "Pay in cash when your order arrives." : paymentMethod === "bkash" ? "bKash payment is shown for checkout preview. No payment will be collected in this demo." : "Card payment is shown for checkout preview. No card details are requested or charged in this demo."}</p>
            </fieldset>

            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded bg-[#1A1815] px-6 py-4 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#332D24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A67C3D] focus-visible:ring-offset-2">Place order <span aria-hidden="true">—</span> {formatPrice(orderTotal)} <ArrowRight size={14} /></button>
            <p className="text-center text-[11px] leading-5 text-[#8A8377]">Demo checkout: this confirms the order on screen only. No payment is processed and no order is sent to a server.</p>
          </div>

          <aside className="h-fit rounded-lg border border-[#DBD5C7] bg-white p-5 shadow-[0_12px_36px_rgba(70,54,29,0.06)] sm:p-6 lg:sticky lg:top-28" aria-labelledby="checkout-summary-heading">
            <h2 id="checkout-summary-heading" className="mb-5 text-sm font-semibold text-[#1A1815]">Order summary <span className="font-normal text-[#8A8377]">({cart.length} {cart.length === 1 ? "item" : "items"})</span></h2>
            <div className="mb-5 max-h-[360px] space-y-4 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="relative h-[68px] w-[60px] shrink-0 overflow-visible"><div className="h-full w-full overflow-hidden rounded border border-[#FFFFFF] bg-[#FFFFFF]"><img src={item.product.images.silo} alt={item.product.name} onError={handleImgError} className="h-full w-full object-cover" /></div><span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1A1815] px-1 text-[10px] text-white">{item.quantity}</span></div>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-xs font-medium leading-snug text-[#1A1815]">{item.product.name}</p>{(item.selectedColor || item.selectedSize || item.selectedFabric || item.selectedLeg) && <p className="mt-1 text-[11px] text-[#8A8377]">{[item.selectedSize, item.selectedColor, item.selectedFabric, item.selectedLeg].filter(Boolean).join(" · ")}</p>}</div>
                    <p className="shrink-0 text-xs font-medium text-[#1A1815]">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-[#DBD5C7] pt-4">
              <div className="flex justify-between text-sm text-[#68635B]"><span>Subtotal</span><span className="font-medium text-[#1A1815]">{formatPrice(cartSubtotal)}</span></div>
              <div className="flex justify-between text-sm text-[#68635B]"><span>{deliveryMethod === "express" ? "Express delivery" : "Standard delivery"}</span><span className="font-medium text-[#1A1815]">{deliveryFee ? formatPrice(deliveryFee) : "Free"}</span></div>
              <div className="flex justify-between border-t border-[#DBD5C7] pt-3 text-base font-semibold text-[#1A1815]"><span>Total</span><span>{formatPrice(orderTotal)}</span></div>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#8A8377]"><Truck size={13} /> {deliveryMethod === "express" ? "Express delivery · 2–4 business days" : "Standard delivery · 5–10 business days"}</p>
          </aside>
        </form>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM PRODUCT REQUEST
// -----------------------------------------------------------------------------
type RequestValues = Record<string, string>;
type RequestControlProps = {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options?: string[];
  placeholder?: string;
  type?: string;
  min?: string;
  error?: string;
};

function RequestControl({ label, name, value, onChange, options, placeholder, type = "text", min, error }: RequestControlProps) {
  const controlClass = `w-full rounded-md border bg-white px-3.5 py-3 text-sm text-[#1A1815] outline-none transition focus:border-[#A67C3D] focus:ring-2 focus:ring-[#A67C3D]/15 ${error ? "border-[#B4593F]" : "border-[#DBD5C7]"}`;
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[12px] font-medium text-[#3A3530]">{label}</span>
      {options ? (
        <select value={value} onChange={(event) => onChange(name, event.target.value)} className={controlClass}>
          <option value="">Select {label.toLowerCase()}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input type={type} min={min} value={value} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} className={controlClass} />
      )}
      {error && <span className="mt-1 block text-[11px] text-[#B4593F]">{error}</span>}
    </label>
  );
}

function RequestTextarea({ label, name, value, onChange, placeholder, maxLength, error }: RequestControlProps & { maxLength?: number }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[12px] font-medium text-[#3A3530]">{label}</span>
      <textarea value={value} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} maxLength={maxLength} rows={4} className={`w-full resize-y rounded-md border bg-white px-3.5 py-3 text-sm text-[#1A1815] outline-none transition placeholder:text-[#A29A8B] focus:border-[#A67C3D] focus:ring-2 focus:ring-[#A67C3D]/15 ${error ? "border-[#B4593F]" : "border-[#DBD5C7]"}`} />
      {error && <span className="mt-1 block text-[11px] text-[#B4593F]">{error}</span>}
    </label>
  );
}

function RequestSection({ number, title, description, children }: { number: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E3DDD1] bg-white p-5 shadow-[0_8px_24px_-24px_rgba(26,24,21,0.3)] sm:p-7">
      <div className="mb-5 flex items-start gap-3 border-b border-[#EEE9E0] pb-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFFFFF] text-[10px] font-semibold text-[#946E35]">{number}</span>
        <div>
          <h2 className="text-base font-medium text-[#1A1815]">{title}</h2>
          {description && <p className="mt-1 text-xs leading-relaxed text-[#8A8377]">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function CustomProductRequest() {
  const { navigate } = useApp();
  const [values, setValues] = useState<RequestValues>({});
  const [errors, setErrors] = useState<RequestValues>({});
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const imageUrls = useRef<string[]>([]);
  const setValue = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));

  useEffect(() => () => imageUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const addImages = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const valid = picked.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 5 * 1024 * 1024);
    if (valid.length !== picked.length) setSubmitError("Reference photos must be JPG, PNG, or WEBP and no larger than 5 MB each.");
    else setSubmitError("");
    if (images.length + valid.length > 4) setSubmitError("You can upload a maximum of 4 reference photos.");
    const allowed = valid.slice(0, Math.max(0, 4 - images.length));
    const previews = allowed.map((file) => {
      const url = URL.createObjectURL(file);
      imageUrls.current.push(url);
      return { file, url };
    });
    if (previews.length) setImages((current) => [...current, ...previews]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
    setSubmitError("");
  };

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    const nextErrors: RequestValues = {};
    ["fullName", "phone", "cityArea", "deliveryAddress", "description"].forEach((field) => {
      if (!values[field]?.trim()) nextErrors[field] = "This field is required.";
    });
    if (values.phone && !/^[+\d][\d\s().-]{6,18}$/.test(values.phone.trim())) nextErrors.phone = "Enter a valid phone number.";
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = "Enter a valid email address.";
    if ((values.description || "").trim().length < 10) nextErrors.description = "Please describe your idea in at least 10 characters.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("fullName", values.fullName.trim());
      form.set("phone", values.phone.trim());
      form.set("email", values.email?.trim() || "");
      form.set("cityArea", values.cityArea.trim());
      form.set("deliveryAddress", values.deliveryAddress.trim());
      form.set("description", values.description.trim());
      form.set("website", values.website || "");
      images.forEach(({ file }) => form.append("photos", file));

      const response = await fetch("/api/custom-requests", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not send your request. Please try again.");
      setSubmittedNumber(result.requestNumber ? `CR-${result.requestNumber}` : "");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedNumber !== null) return (
    <div className="min-h-[65vh] bg-[#FFFFFF] px-5 py-16">
      <div className="mx-auto max-w-2xl rounded-xl border border-[#DBD5C7] bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#E7EADD] text-2xl text-[#6F7D5E]">✓</div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#A67C3D]">Request received</p>
        <h1 className="mb-4 text-2xl font-light text-[#1A1815]" style={{ fontFamily: "'Fraunces', serif" }}>Thank you for sharing your idea.</h1>
        <p className="text-sm leading-relaxed text-[#6D675D]">Your custom request{submittedNumber ? ` ${submittedNumber}` : ""} and reference photos have been sent to our team. We’ll contact you using the details you provided.</p>
        <button onClick={() => navigate("home")} className="mt-7 rounded-md bg-[#1A1815] px-6 py-3 text-[11px] font-medium uppercase tracking-widest text-white">Back to home</button>
      </div>
    </div>
  );

  const input = (label: string, name: string, placeholder: string, type = "text") => <div id={name}><RequestControl label={label} name={name} value={values[name] || ""} onChange={setValue} placeholder={placeholder} type={type} error={errors[name]} /></div>;
  return (
    <div className="min-h-screen bg-[#FFFFFF] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center sm:mb-10">
          <button onClick={() => navigate("home")} className="mb-5 text-[10px] font-medium uppercase tracking-widest text-[#8A8377] hover:text-[#A67C3D]">← Back to home</button>
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#A67C3D]">Made around your idea</p>
          <h1 className="text-3xl font-light text-[#1A1815] sm:text-4xl" style={{ fontFamily: "'Fraunces', serif" }}>Custom Product Request</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#746D62]">Tell us what you would like us to create. Add a description and reference photos, and our team will take it from there.</p>
        </div>

        <form noValidate onSubmit={submitRequest} className="space-y-5">
          <RequestSection number="01" title="Customer Information" description="How can our team reach you about your custom piece?">
            <div className="grid gap-4 sm:grid-cols-2">
              {input("Full Name *", "fullName", "Enter your full name")}
              {input("Phone Number *", "phone", "Enter your phone number", "tel")}
              {input("Email Address", "email", "Enter your email address", "email")}
              {input("City / Area *", "cityArea", "Enter your city or area")}
              <div id="deliveryAddress" className="sm:col-span-2"><RequestTextarea label="Delivery Address *" name="deliveryAddress" value={values.deliveryAddress || ""} onChange={setValue} placeholder="Enter your complete delivery address" error={errors.deliveryAddress} /></div>
            </div>
          </RequestSection>

          <RequestSection number="02" title="Describe Your Idea" description="Share the details that matter to you. Our team will follow up about specifications, pricing, and delivery.">
            <div id="description"><RequestTextarea label="Custom Request Description *" name="description" value={values.description || ""} onChange={setValue} placeholder="Describe the piece you have in mind, including its style, materials, colors, dimensions, or anything else you would like us to know." maxLength={5000} error={errors.description} /></div>
            <p className="mt-2 text-right text-[11px] text-[#8A8377]">{(values.description || "").length} / 5000</p>
            <div className="mt-6 border-t border-[#EEE9E0] pt-5">
              <div className="mb-4"><h3 className="text-[13px] font-medium text-[#1A1815]">Reference Photos</h3><p className="mt-1 text-[11px] leading-relaxed text-[#8A8377]">Upload photos of the design, product, material, color, or style you want us to use as a reference.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((image, index) => <div key={image.url} className="group relative aspect-square overflow-hidden rounded-lg border border-[#DBD5C7] bg-[#FFFFFF]"><img src={image.url} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => removeImage(index)} aria-label={`Remove reference image ${index + 1}`} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg text-[#5D342B] shadow">×</button></div>)}
              {images.length < 4 && <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-[#B9B1A0] bg-[#FFFFFF] text-center text-[#6D675D] transition hover:border-[#A67C3D] hover:bg-[#FFFFFF]"><span className="mb-2 text-3xl font-light text-[#A67C3D]">+</span><span className="text-xs font-medium">Upload Photo</span><span className="mt-1 text-[10px]">JPG, PNG, WEBP</span></button>}
            </div>
            <input ref={fileInput} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => addImages(event.target.files)} />
            <p className="mt-3 text-[11px] text-[#8A8377]">Up to 4 images · 5 MB each · Photos are optional.</p>
            </div>
          </RequestSection>

          <label aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">Website<input tabIndex={-1} autoComplete="off" value={values.website || ""} onChange={(event) => setValue("website", event.target.value)} /></label>
          {submitError && <p role="alert" className="rounded-lg border border-[#e7c8bf] bg-[#fbefeb] px-4 py-3 text-[12px] text-[#9a4d3f]">{submitError}</p>}
          <div className="rounded-xl border border-[#E3DDD1] bg-white p-5 text-center sm:p-7">
            <p className="mb-4 text-xs leading-relaxed text-[#8A8377]">Our team will review your idea and contact you using the information above.</p>
            <button type="submit" disabled={submitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#1A1815] px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-white transition hover:bg-[#39342D] disabled:cursor-wait disabled:opacity-60 sm:w-auto">{submitting ? "Sending your request…" : "Send Custom Request"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessengerChatButton() {
  return (
    <button type="button" aria-label="Chat with us on Facebook Messenger" title="Chat with us on Messenger" className="fixed bottom-20 right-5 z-[300] flex h-14 w-14 items-center justify-center rounded-full bg-[#0866FF] text-white shadow-[0_8px_24px_rgba(8,102,255,0.38)] transition hover:scale-105 hover:bg-[#0759DF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0866FF]/30 md:bottom-6 md:right-6">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <path fill="currentColor" d="M16 4.2C9.05 4.2 3.4 9.25 3.4 15.48c0 3.3 1.55 6.26 4.1 8.2v4.1l3.78-2.08c1.45.43 3.03.66 4.72.66 6.95 0 12.6-5.05 12.6-11.28S22.95 4.2 16 4.2Zm1.46 14.96-3.15-3.35-6.13 3.35 6.8-7.25 3.2 3.35 6.1-3.35-6.82 7.25Z" />
      </svg>
    </button>
  );
}
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function SearchOverlay() {
  const { searchOpen, closeSearch, navigate, products } = useApp();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [searchOpen]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") closeSearch(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [closeSearch]);

  const results = query.trim().length >= 1
    ? products.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

  const popular = ["Table lamps", "Pendant lights", "Wall mirrors", "Lamp shades", "Side tables"];

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-[150] bg-black/40 transition-opacity duration-300"
        style={{ opacity: searchOpen ? 1 : 0, pointerEvents: searchOpen ? "auto" : "none" }}
        onClick={closeSearch}
      />

      {/* Panel — drops from under the header */}
      <div
        className="fixed inset-x-0 z-[151] bg-[#FFFFFF] shadow-xl border-b border-[#DBD5C7] transition-all duration-300 overflow-hidden"
        style={{
          top: 0,
          paddingTop: 104,
          maxHeight: searchOpen ? 560 : 0,
          opacity: searchOpen ? 1 : 0,
          pointerEvents: searchOpen ? "auto" : "none",
        }}
      >
        <div className="max-w-[720px] mx-auto px-8 pb-10">
          {/* Input */}
          <div className="relative mb-8 flex items-center gap-4 border-b-2 border-[#DBD5C7] focus-within:border-[#A67C3D] transition-colors pb-3">
            <Search size={20} className="text-[#8A8377] shrink-0" strokeWidth={1.5} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pieces, materials, styles…"
              className="flex-1 bg-transparent text-[#1A1815] text-[20px] font-light focus:outline-none placeholder-[#B9B1A0]"
              style={{ fontFamily: "'Fraunces', serif" }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-[#8A8377] hover:text-[#1A1815] transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Results */}
          {results.length > 0 ? (
            <div>
              <p className="text-[10px] font-medium tracking-widest uppercase text-[#8A8377] mb-3">Products</p>
              <div className="divide-y divide-[#F0EBE1]">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { closeSearch(); navigate("product", { id: p.id }); }}
                    className="w-full flex items-center gap-4 py-3 hover:bg-[#FFFFFF] px-3 -mx-3 rounded-lg transition-colors text-left group"
                  >
                    <div className="w-11 h-13 rounded-[6px] overflow-hidden bg-[#FFFFFF] shrink-0" style={{ height: 52 }}>
                      <img src={p.images.silo} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1A1815] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#8A8377]">{p.subcategory} · {p.category}</p>
                    </div>
                    <span className="text-[13px] font-medium text-[#1A1815] shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatPrice(p.salePrice ?? p.basePrice)}
                    </span>
                    <ChevronRight size={13} className="text-[#DBD5C7] group-hover:text-[#A67C3D] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
              {results.length === 6 && (
                <button
                  onClick={() => { closeSearch(); navigate("listing"); }}
                  className="mt-4 text-[10px] font-medium tracking-widest uppercase text-[#A67C3D] flex items-center gap-1.5 hover:text-[#6B4B32] transition-colors"
                >
                  See all results <ArrowRight size={11} />
                </button>
              )}
            </div>
          ) : query.trim() ? (
            <p className="text-[14px] text-[#8A8377] text-center py-8">No results for "{query}" — try a different term.</p>
          ) : (
            <div className="grid grid-cols-2 gap-10">
              <div>
                <p className="text-[10px] font-medium tracking-widest uppercase text-[#8A8377] mb-4">Popular searches</p>
                <ul className="space-y-2.5">
                  {popular.map((s) => (
                    <li key={s}>
                      <button
                        onClick={() => setQuery(s)}
                        className="flex items-center gap-2.5 text-[13px] text-[#4A463F] hover:text-[#A67C3D] transition-colors group"
                      >
                        <Search size={12} className="text-[#DBD5C7] group-hover:text-[#A67C3D] transition-colors" />
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-widest uppercase text-[#8A8377] mb-4">Browse categories</p>
                <ul className="space-y-2.5">
                  {CATEGORIES.slice(0, 5).map((c) => (
                    <li key={c.slug}>
                      <button
                        onClick={() => { closeSearch(); navigate("listing", { category: c.slug }); }}
                        className="flex items-center gap-2.5 text-[13px] text-[#4A463F] hover:text-[#A67C3D] transition-colors group"
                      >
                        <ChevronRight size={12} className="text-[#DBD5C7] group-hover:text-[#A67C3D] transition-colors" />
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CART PAGE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CartPage() {
  const { cart, cartSubtotal, updateQty, removeFromCart, navigate } = useApp();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1200px] border-b border-[#DBD5C7] px-6 py-10 md:px-10">
        <div className="mb-4 flex items-center gap-2 text-[11px] text-[#8A8377]">
          <button onClick={() => navigate("home")} className="hover:text-[#1A1815]">Home</button>
          <span>/</span>
          <span className="text-[#4A463F]">Shopping bag</span>
        </div>
        <h1 className="text-[38px] font-light text-[#1A1815] md:text-[44px]" style={{ fontFamily: "'Fraunces', serif" }}>
          Your shopping bag
        </h1>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-10 md:px-10 lg:grid-cols-[1fr_340px]">
        {cart.length === 0 ? (
          <div className="py-16 text-center lg:col-span-2">
            <ShoppingBag size={34} strokeWidth={1} className="mx-auto mb-5 text-[#B9B1A0]" />
            <h2 className="mb-3 text-2xl font-light text-[#1A1815]" style={{ fontFamily: "'Fraunces', serif" }}>
              Your bag is empty
            </h2>
            <p className="mb-7 text-sm text-[#8A8377]">Find something lovely for your home.</p>
            <button
              onClick={() => navigate("listing")}
              className="bg-[#1A1815] px-6 py-3 text-[11px] font-medium uppercase tracking-widest text-white hover:bg-[#2E2A24]"
            >
              Explore the collection
            </button>
          </div>
        ) : (
          <>
            <section aria-label="Items in your shopping bag" className="divide-y divide-[#DBD5C7]">
              {cart.map((item) => (
                <article key={item.id} className="flex gap-5 py-6 first:pt-0">
                  <button
                    type="button"
                    onClick={() => navigate("product", { id: item.product.id })}
                    className="h-32 w-28 shrink-0 overflow-hidden rounded bg-[#FFFFFF] md:h-40 md:w-32"
                    aria-label={`View ${item.product.name}`}
                  >
                    <img src={item.product.images.silo} alt={item.product.name} onError={handleImgError} className="h-full w-full object-cover" />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 sm:flex-row">
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-[#8A8377]">{item.product.subcategory}</p>
                      <button onClick={() => navigate("product", { id: item.product.id })} className="text-left text-sm font-semibold text-[#1A1815] hover:text-[#A67C3D]">
                        {item.product.name}
                      </button>
                      {(item.selectedColor || item.selectedSize || item.selectedFabric || item.selectedLeg) && (
                        <p className="mt-2 text-xs text-[#8A8377]">{[item.selectedSize, item.selectedColor, item.selectedFabric, item.selectedLeg].filter(Boolean).join(" · ")}</p>
                      )}
                      <button type="button" onClick={() => removeFromCart(item.id)} className="mt-4 text-[10px] uppercase tracking-widest text-[#8A8377] underline underline-offset-4 hover:text-[#1A1815]">
                        Remove
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:justify-start">
                      <span className="text-sm font-medium text-[#1A1815]">{formatPrice(item.price * item.quantity)}</span>
                      <div className="flex h-8 items-center border border-[#DBD5C7]">
                        <button type="button" aria-label={`Decrease ${item.product.name} quantity`} onClick={() => updateQty(item.id, item.quantity - 1)} className="w-8 text-[#4A463F] hover:text-[#A67C3D]">−</button>
                        <span className="w-7 text-center text-xs tabular-nums">{item.quantity}</span>
                        <button type="button" aria-label={`Increase ${item.product.name} quantity`} onClick={() => updateQty(item.id, item.quantity + 1)} className="w-8 text-[#4A463F] hover:text-[#A67C3D]">+</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="h-fit rounded bg-[#FFFFFF] p-6">
              <h2 className="mb-5 text-sm font-semibold text-[#1A1815]">Order summary</h2>
              <div className="mb-3 flex justify-between text-sm text-[#4A463F]">
                <span>Subtotal</span><span>{formatPrice(cartSubtotal)}</span>
              </div>
              <div className="mb-5 flex justify-between border-b border-[#DBD5C7] pb-5 text-sm text-[#4A463F]">
                <span>Delivery</span><span>Complimentary</span>
              </div>
              <div className="mb-6 flex justify-between text-base font-semibold text-[#1A1815]">
                <span>Total</span><span>{formatPrice(cartSubtotal)}</span>
              </div>
              <button onClick={() => navigate("checkout")} className="w-full bg-[#1A1815] py-3.5 text-[11px] font-medium uppercase tracking-widest text-white hover:bg-[#2E2A24]">
                Continue to checkout
              </button>
              <button onClick={() => navigate("listing")} className="mt-4 w-full text-center text-[10px] uppercase tracking-widest text-[#4A463F] underline underline-offset-4 hover:text-[#A67C3D]">
                Continue shopping
              </button>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

// WISHLIST PAGE
// ─────────────────────────────────────────────────────────────────────────────

function WishlistPage() {
  const { wishlist, toggleWishlist, addToCart, navigate, products } = useApp();
  const items = products.filter((p) => wishlist.includes(p.id));

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="max-w-[1800px] mx-auto px-8 py-10 border-b border-[#DBD5C7]">
        <div className="flex items-center gap-2 text-[11px] text-[#8A8377] mb-4">
          <button onClick={() => navigate("home")} className="hover:text-[#1A1815] transition-colors">Home</button>
          <span>/</span>
          <span className="text-[#4A463F]">Saved pieces</span>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-[38px] md:text-[44px] font-light text-[#1A1815]" style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em" }}>
            Saved pieces
          </h1>
          {items.length > 0 && (
            <p className="text-[13px] text-[#8A8377] mb-1.5">{items.length} {items.length === 1 ? "piece" : "pieces"}</p>
          )}
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-8 py-12">
        {items.length === 0 ? (
          /* Empty state */
          <div className="py-28 text-center">
            <div className="w-20 h-20 rounded-full bg-[#FFFFFF] flex items-center justify-center mx-auto mb-6">
              <Heart size={28} strokeWidth={1} className="text-[#B9B1A0]" />
            </div>
            <h2 className="text-[24px] font-light text-[#1A1815] mb-3" style={{ fontFamily: "'Fraunces', serif" }}>
              No saved pieces yet
            </h2>
            <p className="text-[14px] text-[#8A8377] mb-8 max-w-xs mx-auto leading-relaxed">
              Tap the heart on any product to save it here for when you're ready.
            </p>
            <button
              onClick={() => navigate("listing")}
              className="inline-flex items-center gap-2 bg-[#1A1815] text-[#FFFFFF] text-[11px] font-medium tracking-widest uppercase px-7 py-3.5 rounded-[4px] hover:bg-[#2E2A24] transition-colors"
            >
              Explore collection <ArrowRight size={13} />
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
              {items.map((product) => {
                const price = product.salePrice ?? product.basePrice;
                return (
                  <div key={product.id}>
                    {/* Image */}
                    <div
                      className="relative overflow-hidden rounded-lg mb-4 cursor-pointer group"
                      style={{ aspectRatio: "4/5", backgroundColor: "#FFFFFF" }}
                      onClick={() => navigate("product", { id: product.id })}
                    >
                      <img
                        src={product.images.silo}
                        alt={product.name}
                        onError={handleImgError}
                        className="absolute inset-0 w-full h-full scale-[1.12] object-cover transition-transform duration-500 group-hover:scale-[1.16]"
                      />
                      {product.badge && (
                        <div className="absolute top-3 left-3"><BadgeTag type={product.badge} /></div>
                      )}
                      {/* Remove heart */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                        aria-label="Remove from saved"
                        className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-sm hover:scale-110 transition-transform"
                      >
                        <Heart size={15} className="fill-[#B4593F] text-[#B4593F]" />
                      </button>
                    </div>

                    {/* Info */}
                    <p className="text-[10px] font-medium tracking-widest uppercase text-[#8A8377] mb-1">{product.subcategory}</p>
                    <button
                      onClick={() => navigate("product", { id: product.id })}
                      className="block w-full text-left text-[14px] font-semibold text-[#1A1815] mb-1 hover:text-[#A67C3D] transition-colors leading-snug"
                    >
                      {product.name}
                    </button>
                    {product.rating && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Stars value={product.rating} />
                        <span className="text-[11px] text-[#8A8377]">{product.rating} ({product.reviewCount})</span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-[14px] font-medium text-[#1A1815]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatPrice(price)}
                      </span>
                      {product.salePrice && (
                        <span className="text-[12px] text-[#8A8377] line-through" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatPrice(product.basePrice)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => addToCart(product, { color: product.swatches[0]?.label })}
                      className="w-full border border-[#1A1815] text-[#1A1815] text-[10px] font-medium tracking-widest uppercase py-2.5 rounded-[4px] hover:bg-[#1A1815] hover:text-[#FFFFFF] transition-colors"
                    >
                      Add to cart
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#DBD5C7] mt-12 pt-8 text-center">
              <button
                onClick={() => navigate("listing")}
                className="inline-flex items-center gap-2 text-[10px] font-medium tracking-widest uppercase text-[#4A463F] hover:text-[#A67C3D] transition-colors"
              >
                Continue browsing <ArrowRight size={11} />
              </button>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────

function MobileBottomNav() {
  const { currentPage, wishlist, cartCount, user, navigate, openMiniCart, goBack } = useApp();
  const [isIPhone, setIsIPhone] = useState(false);

  useEffect(() => {
    setIsIPhone(/iPhone|iPod/i.test(navigator.userAgent));
  }, []);

  const items = [
    ...(isIPhone ? [{ label: "Back", icon: ArrowLeft, action: goBack, active: false }] : []),
    { label: "Home", icon: Home, action: () => navigate("home"), active: currentPage.name === "home" },
    { label: "Wishlist", icon: Heart, action: () => navigate("wishlist"), count: wishlist.length, active: currentPage.name === "wishlist" },
    { label: "Cart", icon: ShoppingCart, action: openMiniCart, count: cartCount, active: currentPage.name === "cart" },
    { label: "Profile", icon: User, action: () => navigate(user ? "account" : "login"), active: ["account", "login", "register"].includes(currentPage.name) },
  ];

  return (
    <nav aria-label="Mobile navigation" className={`mobile-bottom-nav fixed inset-x-0 bottom-0 z-[80] grid ${isIPhone ? "grid-cols-5" : "grid-cols-4"} border-t border-[#E4E4E4] bg-white px-1 md:hidden`}>
      {items.map(({ label, icon: Icon, action, count, active }) => (
        <button key={label} type="button" onClick={action} aria-label={label} aria-current={active ? "page" : undefined} className={`relative flex h-10 items-center justify-center text-[#171717] transition-colors ${active ? "" : "opacity-75 hover:opacity-100"}`}>
          <Icon size={18} strokeWidth={active ? 2 : 1.7} />
          {typeof count === "number" && <span className="absolute left-[calc(50%+8px)] top-[10px] text-[9px] leading-none text-[#171717]">{count}</span>}
        </button>
      ))}
    </nav>
  );
}

type AccountRoute = "account" | "login" | "register" | "forgot-password" | "reset-password";

function AccountAuthPage() {
  const { currentPage, user, authReady, signOut, navigate } = useApp();
  const supabase = createSupabaseBrowserClient();
  const route = currentPage.name as AccountRoute;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetComplete, setResetComplete] = useState(false);
  const [confirmationIssue, setConfirmationIssue] = useState(false);
  const configured = Boolean(supabase);
  const title = route === "register" ? "Create your account" : route === "forgot-password" ? "Reset your password" : route === "reset-password" ? "Choose a new password" : "Welcome back";
  const inputClass = "w-full rounded-md border border-[#DBD5C7] bg-white px-4 py-3 text-sm text-[#1A1815] placeholder:text-[#9A9388] outline-none transition focus:border-[#A67C3D] focus:ring-2 focus:ring-[#A67C3D]/15";

  useEffect(() => {
    setConfirmationIssue(route === "login" && new URLSearchParams(window.location.search).has("error"));
  }, [route]);

  useEffect(() => {
    if (authReady && user && (route === "login" || route === "register")) navigate("account");
  }, [authReady, user, route, navigate]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      if (route === "register") {
        if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");
        if (password !== confirmPassword) throw new Error("Your passwords do not match.");
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", "/account");
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: callback.toString(), data: { full_name: name.trim() } },
        });
        if (authError) throw authError;
        if (data.session) navigate("account");
        else setNotice("Your account is ready. Check your email to confirm your address, then sign in.");
      } else if (route === "forgot-password") {
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", "/reset-password");
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback.toString() });
        if (authError) throw authError;
        setNotice("If an account exists for that email, a password reset link is on its way.");
      } else if (route === "reset-password") {
        if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");
        if (password !== confirmPassword) throw new Error("Your passwords do not match.");
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        await supabase.auth.signOut();
        setResetComplete(true);
        setNotice("Your password has been updated. Sign in with your new password.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        navigate("account");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn’t complete that request. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (route === "account" && user) {
    const displayName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "there";
    return (
      <section className="mx-auto min-h-[65vh] max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#A67C3D]">Your account</p>
        <h1 className="mb-8 text-4xl font-light text-[#1A1815]" style={{ fontFamily: "'Fraunces', serif" }}>Welcome, {displayName}</h1>
        <div className="rounded-xl border border-[#DBD5C7] bg-white p-6 sm:p-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[#8A8377]">Signed in as</p>
          <p className="text-sm text-[#1A1815]">{user.email}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate("listing")} className="rounded bg-[#1A1815] px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-white transition hover:bg-[#332D24]">Continue shopping</button>
            <button type="button" onClick={async () => { try { await signOut(); navigate("home"); } catch (signOutError) { setError(signOutError instanceof Error ? signOutError.message : "Sign out failed."); } }} className="rounded border border-[#DBD5C7] px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-[#4A463F] transition hover:border-[#A67C3D]">Sign out</button>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[#A33E34]">{error}</p>}
        </div>
      </section>
    );
  }

  if (route === "account" && !authReady) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-[#8A8377]">Loading your account…</div>;
  }

  const isRegistration = route === "register";
  const isRecoveryRequest = route === "forgot-password";
  const isPasswordUpdate = route === "reset-password";
  const isSignIn = !isRegistration && !isRecoveryRequest && !isPasswordUpdate;

  return (
    <section className="mx-auto grid min-h-[calc(100vh-92px)] max-w-[1240px] items-center gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-10 lg:py-16">
      <div className="hidden min-h-[500px] flex-col justify-between overflow-hidden rounded-2xl bg-[#20242D] p-10 text-[#FFFFFF] lg:flex" style={{ backgroundImage: "radial-gradient(circle at 85% 15%, rgba(201,163,98,.22), transparent 32%), radial-gradient(circle at 10% 90%, rgba(97,111,146,.3), transparent 42%), linear-gradient(145deg,#252A34,#171A20)" }}>
        <span className="text-xs uppercase tracking-[0.2em] text-[#D4B77C]">Cloud Lamps &amp; Mirrors</span>
        <div>
          <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-[#D4B77C]">A considered home, made personal</p>
          <p className="max-w-md text-4xl font-light leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>Keep the pieces you love close.</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">Sign in to make your next visit feel right at home.</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">Thoughtfully chosen · Made to last</span>
      </div>

      <div className="mx-auto w-full max-w-md rounded-xl border border-[#E5DFD3] bg-white p-6 shadow-[0_18px_55px_rgba(26,24,21,0.07)] sm:p-9">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#A67C3D]">Customer account</p>
        <h1 className="mb-2 text-3xl font-light text-[#1A1815]" style={{ fontFamily: "'Fraunces', serif" }}>{title}</h1>
        <p className="mb-7 text-sm leading-6 text-[#777168]">{isRegistration ? "Create an account to keep your details together for next time." : isRecoveryRequest ? "Enter your account email and we’ll send a secure reset link." : isPasswordUpdate ? "Choose a new password for your account." : "Sign in to your Cloud Lamps & Mirrors account."}</p>

        {!configured && <p role="status" className="mb-5 rounded-md border border-[#D9C79E] bg-[#FAF5E9] p-3 text-xs leading-5 text-[#695632]">Supabase is not configured yet. Add your project URL and publishable key to <code>.env.local</code>, then restart the development server.</p>}
        {confirmationIssue && <p role="alert" className="mb-4 text-xs text-[#A33E34]">That email confirmation link could not be completed. Please try registering again or request a fresh link.</p>}
        {error && <p role="alert" className="mb-4 rounded-md bg-[#F9ECE8] p-3 text-xs leading-5 text-[#A33E34]">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-md bg-[#EDF1E8] p-3 text-xs leading-5 text-[#506044]">{notice}</p>}

        {!resetComplete && <form onSubmit={submit} className="space-y-4">
          {isRegistration && <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#4A463F]">Full name</span><input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Your name" /></label>}
          {!isPasswordUpdate && <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#4A463F]">Email address</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="you@example.com" /></label>}
          {!isRecoveryRequest && <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#4A463F]">{isPasswordUpdate ? "New password" : "Password"}</span><input required minLength={8} type="password" autoComplete={isRegistration || isPasswordUpdate ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder="At least 8 characters" /></label>}
          {(isRegistration || isPasswordUpdate) && <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#4A463F]">Confirm password</span><input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} placeholder="Enter your password again" /></label>}
          <button type="submit" disabled={pending || !configured} className="flex w-full items-center justify-center gap-2 rounded bg-[#1A1815] px-5 py-3.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white transition hover:bg-[#332D24] disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? "Please wait…" : isRegistration ? "Create account" : isRecoveryRequest ? "Send reset link" : isPasswordUpdate ? "Save new password" : "Sign in"} {!pending && <ArrowRight size={13} />}
          </button>
        </form>}

        <div className="mt-5 flex flex-col gap-3 text-center text-xs text-[#746D62]">
          {isSignIn && <button type="button" onClick={() => navigate("forgot-password")} className="underline underline-offset-4 transition hover:text-[#A67C3D]">Forgot your password?</button>}
          {isSignIn && <p>New here? <button type="button" onClick={() => navigate("register")} className="font-medium text-[#8D642D] underline underline-offset-4">Create an account</button></p>}
          {isRegistration && <p>Already have an account? <button type="button" onClick={() => navigate("login")} className="font-medium text-[#8D642D] underline underline-offset-4">Sign in</button></p>}
          {(isRecoveryRequest || isPasswordUpdate || resetComplete) && <button type="button" onClick={() => navigate("login")} className="font-medium text-[#8D642D] underline underline-offset-4">Back to sign in</button>}
        </div>
      </div>
    </section>
  );
}

function AppInner() {
  const { currentPage } = useApp();
  const headerOffset = 92;

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Header />
      <SearchOverlay />
      <main key={`${currentPage.name}:${currentPage.params?.id ?? currentPage.params?.category ?? ""}`} className={`mobile-nav-main storefront-page-enter ${currentPage.name === "home" ? "home-hero-main" : ""}`} style={{ paddingTop: headerOffset }}>
        {currentPage.name === "home" && <HomePage />}
        {currentPage.name === "custom-request" && <CustomProductRequest />}
        {currentPage.name === "listing" && <ListingPage params={currentPage.params} />}
        {currentPage.name === "product" && <ProductPage key={currentPage.params?.id} params={currentPage.params} />}
        {currentPage.name === "checkout" && <CheckoutPage />}
        {currentPage.name === "cart" && <CartPage />}
        {currentPage.name === "wishlist" && <WishlistPage />}
        {["account", "login", "register", "forgot-password", "reset-password"].includes(currentPage.name) && <AccountAuthPage />}
      </main>
      <MiniCartDrawer />
      <MessengerChatButton />
      <MobileBottomNav />
      <Toaster />
    </div>
  );
}

export default function App() {
  return <AppInner />;
}










