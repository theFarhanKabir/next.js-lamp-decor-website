export interface SizeOption { label: string; delta: number; }
export interface Swatch { color: string; label: string; imageUrl?: string; }
export interface ProductDimensions { width?: string; depth?: string; height?: string; top?: string; weight?: string; [key: string]: string | undefined; }
export interface ProductMaterialDetails { finish?: string; assembly?: string; care?: string; warranty?: string; [key: string]: string | undefined; }

export interface Product {
  id: string;
  name: string;
  category: string;
  categorySlug?: string;
  subcategory: string;
  subcategorySlug?: string;
  description: string;
  badge?: "new" | "sale" | "pre-order" | "sold-out";
  promotions?: ("new" | "sale")[];
  basePrice: number;
  salePrice?: number;
  rating?: number;
  reviewCount?: number;
  swatches: Swatch[];
  images: { silo: string; lifestyle: string; siloSrcSet?: string; lifestyleSrcSet?: string };
  imageVariants?: Record<string, { url: string; width: number }[]>;
  gallery?: string[];
  sizes?: SizeOption[];
  fabrics?: SizeOption[];
  legs?: SizeOption[];
  orderType: "in-stock" | "made-to-order";
  leadTime?: string;
  materials?: string[];
  dimensions?: ProductDimensions | string;
  sizeDimensions?: Record<string, ProductDimensions>;
  materialDetails?: ProductMaterialDetails;
}

export const COLLECTION_SLUGS = [
  "lighting", "mirrors", "tables", "shades", "new", "sale",
] as const;
