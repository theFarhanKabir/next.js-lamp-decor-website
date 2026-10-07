import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Checkout | Cloud Lamps & Mirrors" };

export default function CheckoutRoute() {
  return <StorefrontRoute />;
}
