import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Create account | Cloud Lamps & Mirrors" };

export default function RegisterPage() {
  return <StorefrontRoute />;
}
