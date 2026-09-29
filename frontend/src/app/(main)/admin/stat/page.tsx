import { auth } from "@/auth";
import Stats from "./view";

export default async function StatPage() {
  const session = await auth();

  return <Stats token={session?.user.backendToken ?? ""} />;
}
