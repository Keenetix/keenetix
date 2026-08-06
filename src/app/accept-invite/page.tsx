import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/accept-invite-form";
export const metadata = { title: "Accept invite" };
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <AcceptInviteForm />
    </Suspense>
  );
}
