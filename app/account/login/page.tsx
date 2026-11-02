import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function Page() {
  return (
    <div className="container-x py-14">
      <Suspense><AuthForm mode="login" /></Suspense>
    </div>
  );
}
