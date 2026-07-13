import { redirect } from "next/navigation";
import { SignInForm } from "@/components/SignInForm";
import { getCurrentUser } from "@/lib/user";

export default async function SignInPage() {
  /// getCurrentUser(), NOT auth(). This is the more important of the two gates to get right:
  /// `auth()` accepts any signature-valid JWT, including one revoked by a password change. If
  /// this page bounced on that, a user whose token had just been revoked would be redirected
  /// away from the only page that can let them back in — locked out of an app they own, with
  /// no route to the sign-in form. Checking the live tokenVersion means a dead token lands
  /// here, which is exactly where it should land.
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="grid flex-1 place-items-center px-6">
      <div className="w-full max-w-xs">
        <h1 className="text-center text-xl font-semibold">MacroLens</h1>
        <p className="mt-1 text-center text-xs text-muted">
          Log meals by photo, text or barcode.
        </p>

        <div className="mt-8">
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
