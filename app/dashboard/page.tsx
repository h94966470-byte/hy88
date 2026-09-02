import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminDashboard from "../components/AdminDashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("role" in session.user) || session.user.role !== "admin") {
    redirect("/");
  }

  return <AdminDashboard />;
}
