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

  // Max is a Pro feature with no self-hosted equivalent, so a deployment without a
  // Pro service has nothing to offer behind this button — showing it would be an ad
  // for something that installation cannot provide. Hosted deployments set
  // PRO_SERVICE_URL and free-plan users get the dock plus an upgrade path.
  // Server-side check, so the dock never reaches the browser when it is off.
  const proAvailable = Boolean(process.env.PRO_SERVICE_URL);

  return (
    <>
      <Sidebar />
      <main className="md:ml-60 min-h-dvh pt-14 md:pt-0">{children}</main>
      {proAvailable && <AssistantDock />}
      <SessionToast />
    </>
  );
}
