import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { googleEnabled } from "@/lib/auth";

export const metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="register" google={googleEnabled} />
    </Suspense>
  );
}
