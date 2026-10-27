import { PasswordForm } from "./PasswordForm";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <section className="card">
        <h2 className="text-base font-semibold">Your account</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-stone-500">Username</dt>
          <dd className="font-medium">{user.username}</dd>
          <dt className="text-stone-500">Email</dt>
          <dd className="font-medium">{user.email}</dd>
          <dt className="text-stone-500">Role</dt>
          <dd className="font-medium capitalize">{user.role}</dd>
        </dl>
      </section>

      <section className="card">
        <h2 className="text-base font-semibold">Change password</h2>
        <p className="mb-4 text-sm text-stone-500">Every other device where you are logged in will be logged out.</p>
        <PasswordForm />
      </section>
    </div>
  );
}
