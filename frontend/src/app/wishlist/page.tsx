import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Saved Pieces | Cloud Lamps & Mirrors" };

export default function WishlistRoute() {
  return <StorefrontRoute />;
}
