import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">SplitTab</h1>
          <p className="text-sm text-muted-foreground">Create your account — we&apos;ll send a verification code</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
