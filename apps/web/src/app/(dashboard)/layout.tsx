import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decode } from "next-auth/jwt";
import { Sidebar } from "../components/sidebar";
import { AssistantDock } from "../components/assistant-dock";
import { SessionToast } from "../components/session-toast";

// Fixed cookie name pinned by the API (authConfig.cookies); also the JWE salt.
const SESSION_COOKIE = "authjs.session-token";

// Server-side auth gate. Runs in the Node.js runtime, so it can read AUTH_SECRET
// at runtime and cryptographically verify the session — unlike Edge middleware,
// which inlines env at build time and can only presence-check.
async function requireSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  let valid = false;
  if (token) {
    try {
      const session = await decode({
        token,
        secret: process.env.AUTH_SECRET ?? "",
        salt: SESSION_COOKIE,
      });
      valid = !!session;
    } catch {
      valid = false;
    }
  }
  if (!valid) redirect("/sign-in");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return (
    <>
      <Sidebar />
      <main className="ml-60 min-h-screen">{children}</main>
      <AssistantDock />
      <SessionToast />
    </>
  );
}
