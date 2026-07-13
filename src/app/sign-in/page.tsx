import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { SignInForm } from "@/components/SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  // Already signed in? The sign-in page is a dead end — send them to their food log.
  if (await auth()) redirect("/");

  const { sent, error } = await searchParams;

  async function send(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    // redirectTo, not redirect:false — Auth.js sends the user to /sign-in?sent=1 via the
    // `verifyRequest` page configured in auth.ts.
    await signIn("email", { email, redirectTo: "/" });
  }

  return (
    <main className="grid flex-1 place-items-center px-6">
      <div className="w-full max-w-xs">
        <h1 className="text-center text-xl font-semibold">MacroLens</h1>
        <p className="mt-1 text-center text-xs text-muted">
          Log meals by photo, text or barcode.
        </p>

        <div className="mt-8">
          {sent ? (
            <div className="rounded-xl border border-border bg-surface p-5 text-center">
              <p className="text-sm font-medium">Check your email</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                We sent you a sign-in link. It works once and expires in two hours.
              </p>
            </div>
          ) : (
            <SignInForm action={send} error={error} />
          )}
        </div>
      </div>
    </main>
  );
}
