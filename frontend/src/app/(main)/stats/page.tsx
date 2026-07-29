import { auth } from "@/auth";
import StatTest from "./StatTest";

export default async function StatsPage() {
  const session = await auth();
  return (
    <StatTest
      isAdmin={session?.user.role === "admin"}
      token={session?.user.backendToken ?? ""}
    />
  );
}
