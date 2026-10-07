import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Reset password | Cloud Lamps & Mirrors" };

export default function ForgotPasswordPage() {
  return <StorefrontRoute />;
}
