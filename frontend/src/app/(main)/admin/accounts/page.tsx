import { auth } from "@/auth";
import Accounts from "./list";

export default async function AccountsPage() {
  const session = await auth();

  return <Accounts token={session?.user.backendToken ?? ""} />;
}
