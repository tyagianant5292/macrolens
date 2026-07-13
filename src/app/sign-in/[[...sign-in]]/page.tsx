import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="grid flex-1 place-items-center p-6">
      <SignIn />
    </main>
  );
}
