export interface SizeOption { label: string; delta: number; }
export interface FabricOption { label: string; delta: number; }
export interface LegOption { label: string; delta: number; }
export interface Swatch { color: string; label: string; imageUrl?: string; }

export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  badge?: "new" | "sale" | "pre-order" | "sold-out";
  basePrice: number;
  salePrice?: number;
  rating?: number;
  reviewCount?: number;
  swatches: Swatch[];
  images: { silo: string; lifestyle: string };
  gallery?: string[];
  sizes?: SizeOption[];
  fabrics?: FabricOption[];
  legs?: LegOption[];
  orderType: "in-stock" | "made-to-order";
  leadTime?: string;
  materials?: string[];
  dimensions?: string;
}

const imageUrl = (id: string, width = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

export const PRODUCTS: Product[] = [
  {
    id: "marlow-table-lamp", name: "Marlow Table Lamp", category: "Lighting", subcategory: "Table Lamps",
    description: "A sculptural ceramic base and softly tapered shade bring a warm, quiet glow to bedside tables and reading corners.",
    badge: "new", basePrice: 42000, rating: 4.8, reviewCount: 18,
    swatches: [{ color: "#C9A362", label: "Brushed Brass" }, { color: "#E8E0D4", label: "Ivory" }],
    images: { silo: imageUrl("photo-1564540574859-0dfb63985953"), lifestyle: imageUrl("photo-1775667693473-91e07000bb1a") }, orderType: "in-stock",
  },
  {
    id: "solis-pendant", name: "Solis Dome Pendant", category: "Lighting", subcategory: "Pendant Lights",
    description: "A generous spun-metal shade casts focused, welcoming light over kitchen islands and dining tables.",
    badge: "new", basePrice: 68000, rating: 4.7, reviewCount: 14,
    swatches: [{ color: "#C9A362", label: "Warm Brass" }, { color: "#F0EBE0", label: "Chalk" }],
    images: { silo: imageUrl("photo-1775667693473-91e07000bb1a"), lifestyle: imageUrl("photo-1778880707611-d1f09e32b4e2") }, orderType: "in-stock",
  },
  {
    id: "oslo-side-table", name: "Oslo Side Table", category: "Tables", subcategory: "Side Tables",
    description: "A compact oak table with a rounded top, sized for a favourite lamp, a book, and a cup of tea.",
    basePrice: 54000, rating: 4.9, reviewCount: 32,
    swatches: [{ color: "#C8A96E", label: "Natural Oak" }, { color: "#6B4B32", label: "Smoked Oak" }],
    images: { silo: imageUrl("photo-1506439773649-6e0eb8cfb237"), lifestyle: imageUrl("photo-1784651859128-b04c1d4732f3") }, orderType: "in-stock",
  },
  {
    id: "cleo-wall-sconce", name: "Cleo Wall Sconce", category: "Lighting", subcategory: "Wall Lights",
    description: "A petite brass wall light with a softly diffused glow for hallways, bedside reading, and layered lighting.",
    basePrice: 36000, rating: 4.6, reviewCount: 11,
    swatches: [{ color: "#C9A362", label: "Brushed Brass" }, { color: "#3A3530", label: "Matte Black" }],
    images: { silo: imageUrl("photo-1778880707611-d1f09e32b4e2"), lifestyle: imageUrl("photo-1775667693473-91e07000bb1a") }, orderType: "in-stock",
  },
  {
    id: "milo-console-table", name: "Milo Console Table", category: "Tables", subcategory: "Console Tables",
    description: "A slim oak console creates a considered landing spot for keys, a mirror, and a small accent lamp.",
    basePrice: 92000, rating: 4.7, reviewCount: 21,
    swatches: [{ color: "#C8A96E", label: "Natural Oak" }, { color: "#6B4B32", label: "Walnut" }],
    images: { silo: imageUrl("photo-1784651859128-b04c1d4732f3"), lifestyle: imageUrl("photo-1542485028-6e019f9c8a8e") }, orderType: "in-stock",
  },
  {
    id: "iris-dining-table", name: "Iris Dining Table", category: "Tables", subcategory: "Dining Tables",
    description: "A clean-lined solid ash table with room for shared meals, good conversation, and a beautiful pendant overhead.",
    badge: "sale", basePrice: 180000, salePrice: 155000, rating: 4.9, reviewCount: 27,
    swatches: [{ color: "#D4B896", label: "Natural Ash" }, { color: "#6B4B32", label: "Walnut" }],
    images: { silo: imageUrl("photo-1784651859128-b04c1d4732f3"), lifestyle: imageUrl("photo-1775667693473-91e07000bb1a") }, orderType: "in-stock",
  },
  {
    id: "nora-table-lamp", name: "Nora Glass Table Lamp", category: "Lighting", subcategory: "Table Lamps",
    description: "Clear, hand-finished glass and a linen shade create an airy accent that works from desk to bedside.",
    basePrice: 48000, rating: 4.7, reviewCount: 25,
    swatches: [{ color: "#E8E0D4", label: "Clear Glass" }, { color: "#6B7A8D", label: "Smoked Glass" }],
    images: { silo: imageUrl("photo-1564540574859-0dfb63985953"), lifestyle: imageUrl("photo-1780140765084-88e4e0d75528") }, orderType: "in-stock",
  },
  {
    id: "arc-floor-lamp", name: "Arc Floor Lamp", category: "Lighting", subcategory: "Floor Lamps",
    description: "A slender arched stem and generous linen shade bring warm, adjustable light beside a reading nook.",
    basePrice: 115000, rating: 4.8, reviewCount: 22,
    swatches: [{ color: "#E8E0D4", label: "Travertine & Linen" }, { color: "#3A3530", label: "Marble & Charcoal" }],
    images: { silo: imageUrl("photo-1778880707611-d1f09e32b4e2"), lifestyle: imageUrl("photo-1775667693473-91e07000bb1a") }, orderType: "in-stock",
  },
  {
    id: "solene-wall-mirror", name: "Solene Arched Wall Mirror", category: "Mirrors", subcategory: "Wall Mirrors",
    description: "A softly arched mirror framed in warm brushed brass, made to brighten an entryway or dressing space.",
    basePrice: 68000, rating: 4.8, reviewCount: 14,
    swatches: [{ color: "#C9A362", label: "Brushed Brass" }, { color: "#3A3530", label: "Matte Black" }],
    images: { silo: imageUrl("photo-1542485028-6e019f9c8a8e"), lifestyle: imageUrl("photo-1774428571582-9bd41e95a6ca") }, orderType: "in-stock",
  },
  {
    id: "isla-linen-lamp-shade", name: "Isla Linen Lamp Shade", category: "Shades", subcategory: "Lamp Shades",
    description: "A tapered natural-linen shade that gives table lamps a warm, softly diffused glow.",
    basePrice: 18000, rating: 4.6, reviewCount: 11,
    swatches: [{ color: "#F0EBE0", label: "Natural Linen" }, { color: "#D8C7AD", label: "Warm Sand" }],
    images: { silo: imageUrl("photo-1774444052266-2e4b58d85c3b"), lifestyle: imageUrl("photo-1564540574859-0dfb63985953") }, orderType: "in-stock",
  },
  {
    id: "remy-marble-side-table", name: "Remy Marble Side Table", category: "Tables", subcategory: "Side Tables",
    description: "A pale marble top and fine metal base make an elegant perch for a lamp or a favourite object.",
    basePrice: 76000, rating: 4.7, reviewCount: 19,
    swatches: [{ color: "#E8E0D4", label: "White Marble" }, { color: "#9B8E82", label: "Grey Marble" }],
    images: { silo: imageUrl("photo-1506439773649-6e0eb8cfb237"), lifestyle: imageUrl("photo-1784651859128-b04c1d4732f3") }, orderType: "in-stock",
  },
  {
    id: "ellery-full-length-mirror", name: "Ellery Full-Length Mirror", category: "Mirrors", subcategory: "Full-Length Mirrors",
    description: "A generous full-length mirror with a slim oak frame and a clean, timeless profile.",
    basePrice: 94000, rating: 4.7, reviewCount: 9,
    swatches: [{ color: "#C8A96E", label: "Natural Oak" }, { color: "#6B4B32", label: "Walnut" }],
    images: { silo: imageUrl("photo-1774428571582-9bd41e95a6ca"), lifestyle: imageUrl("photo-1542485028-6e019f9c8a8e") }, orderType: "in-stock",
  },
  {
    id: "marin-pleated-shade", name: "Marin Pleated Shade", category: "Shades", subcategory: "Lamp Shades",
    description: "A softly pleated cotton shade with a classic silhouette for a calm, layered interior.",
    basePrice: 22000, rating: 4.8, reviewCount: 8,
    swatches: [{ color: "#F0EBE0", label: "Ivory" }, { color: "#D9C8B1", label: "Oatmeal" }],
    images: { silo: imageUrl("photo-1774444052266-2e4b58d85c3b"), lifestyle: imageUrl("photo-1778880707611-d1f09e32b4e2") }, orderType: "in-stock",
  },
  {
    id: "luna-pendant", name: "Luna Opal Pendant", category: "Lighting", subcategory: "Pendant Lights",
    description: "A rounded opal-glass pendant diffuses an even, gentle light over dining tables and quiet corners.",
    badge: "new", basePrice: 58000, rating: 4.8, reviewCount: 16,
    swatches: [{ color: "#F0EBE0", label: "Opal & Brass" }, { color: "#3A3530", label: "Opal & Black" }],
    images: { silo: imageUrl("photo-1775667693473-91e07000bb1a"), lifestyle: imageUrl("photo-1778880707611-d1f09e32b4e2") }, orderType: "in-stock",
  },
  {
    id: "mira-round-mirror", name: "Mira Round Mirror", category: "Mirrors", subcategory: "Round Mirrors",
    description: "A round, polished-edge mirror that brings light and a calm focal point to any wall.",
    basePrice: 52000, rating: 4.6, reviewCount: 13,
    swatches: [{ color: "#C9A362", label: "Brass" }, { color: "#9B8E82", label: "Silver" }],
    images: { silo: imageUrl("photo-1542485028-6e019f9c8a8e"), lifestyle: imageUrl("photo-1774428571582-9bd41e95a6ca") }, orderType: "in-stock",
  },
  {
    id: "cole-nesting-tables", name: "Cole Nesting Tables", category: "Tables", subcategory: "Nesting Tables",
    description: "Two easy-to-move nesting tables add a useful surface beside a favourite chair or beneath a statement mirror.",
    basePrice: 64000, rating: 4.7, reviewCount: 17,
    swatches: [{ color: "#D4B896", label: "Natural Ash" }, { color: "#6B4B32", label: "Walnut" }],
    images: { silo: imageUrl("photo-1784651859128-b04c1d4732f3"), lifestyle: imageUrl("photo-1506439773649-6e0eb8cfb237") }, orderType: "in-stock",
  },
  {
    id: "noor-velvet-shade", name: "Noor Velvet Lamp Shade", category: "Shades", subcategory: "Lamp Shades",
    description: "Soft velvet and a warm-toned lining give this tailored shade a rich finish and an inviting evening glow.",
    basePrice: 26000, rating: 4.8, reviewCount: 12,
    swatches: [{ color: "#8FA07E", label: "Sage" }, { color: "#6B4B32", label: "Cocoa" }],
    images: { silo: imageUrl("photo-1774444052266-2e4b58d85c3b"), lifestyle: imageUrl("photo-1564540574859-0dfb63985953") }, orderType: "in-stock",
  },
];

export const COLLECTION_SLUGS = [
  "lighting", "mirrors", "tables", "shades", "new", "sale",
] as const;
