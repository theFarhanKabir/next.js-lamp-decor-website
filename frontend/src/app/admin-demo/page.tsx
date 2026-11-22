import type { Metadata } from "next";
import AdminDemoPanel from "../../components/admin/AdminDemoPanel";

export const metadata: Metadata = {
  title: "Admin preview | Cloud Lamps & Mirrors",
  description: "Read-only sample preview of the Cloud Lamps & Mirrors admin workspace.",
  robots: { index: false, follow: false },
};

export default function AdminDemoPage() {
  return <AdminDemoPanel />;
}
