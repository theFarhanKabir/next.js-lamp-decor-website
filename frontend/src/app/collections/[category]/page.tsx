import type { Metadata } from "next";
import { COLLECTION_SLUGS } from "../../catalog";
import StorefrontRoute from "../../storefront-route";

type CategoryRouteProps = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return COLLECTION_SLUGS.map((category) => ({ category }));
}

// Keep built-in collections prerendered while allowing admin-created Supabase
// subcategories to resolve on demand.
export const dynamicParams = true;

export async function generateMetadata({ params }: CategoryRouteProps): Promise<Metadata> {
  const { category } = await params;
  const title = category.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { title: `${title} | Cloud Lamps & Mirrors` };
}

export default function CategoryPage() {
  return <StorefrontRoute />;
}
