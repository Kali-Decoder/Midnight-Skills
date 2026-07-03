import { getSessionUser } from "@/lib/auth";
import { Navbar } from "@/components/layout/navbar";

export async function NavbarWithAuth() {
  const user = await getSessionUser();
  return <Navbar user={user} />;
}
