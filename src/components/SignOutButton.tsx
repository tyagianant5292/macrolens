import { LogOut } from "lucide-react";
import { signOut } from "@/auth";

/// A server-action form, not a client button. Sign-out must invalidate the Session row on the
/// server; a client-side cookie clear would leave the session live and reusable.
export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/sign-in" });
      }}
    >
      <button
        type="submit"
        aria-label="Sign out"
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
      >
        <LogOut className="size-[17px]" />
      </button>
    </form>
  );
}
