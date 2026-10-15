import type { Metadata } from "next";
import { PRODUCTS } from "../../catalog";
import StorefrontRoute from "../../storefront-route";

type ProductRouteProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { id } = await params;
  const product = PRODUCTS.find((item) => item.id === id);
  return {
    title: product ? `${product.name} | Cloud Lamps & Mirrors` : "Product | Cloud Lamps & Mirrors",
    description: product?.description ?? "Shop furniture, lighting, and mirrors from Cloud Lamps & Mirrors.",
  };
}

export default async function ProductPage({ params }: ProductRouteProps) {
  const { id } = await params;
  // Product slugs can be created later in Supabase, so keep this route dynamic.
  return <StorefrontRoute />;
}
