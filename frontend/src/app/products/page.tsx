import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "All Products | Cloud Lamps & Mirrors" };

export default function ProductsPage() {
  return <StorefrontRoute />;
}
