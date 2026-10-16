import type { Metadata } from "next";
import StorefrontRoute from "../../storefront-route";

type ProductRouteProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { id } = await params;
  const title = id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    title: `${title} | Cloud Lamps & Mirrors`,
    description: "Shop furniture, lighting, and mirrors from Cloud Lamps & Mirrors.",
  };
}

export default async function ProductPage({ params }: ProductRouteProps) {
  const { id } = await params;
  // Product slugs can be created later in Supabase, so keep this route dynamic.
  return <StorefrontRoute />;
}
