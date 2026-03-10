import { BackButton } from '@/components/BackButton';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <BackButton />

        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective date: March 10, 2026</p>

        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When you create an account, we collect your first and last name, email address, and
              phone number. When you upload a receipt, we collect the image you provide.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">How We Use Your Data</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use your information to provide the Split Tab service: creating your account,
              splitting bills with others, and sending SMS payment reminders. Receipt images are
              sent to the Google Gemini API for AI-powered parsing. Your phone number is used
              exclusively to send payment reminders via Twilio when a bill owner requests payment.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Data Storage</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your account data and bill information are stored in Supabase, a hosted database and
              authentication service. Receipt images are stored in Supabase Storage.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What We Don&apos;t Do</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We do not sell your personal information. We do not use your data for advertising or
              marketing purposes. We do not send unsolicited messages.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Split Tab uses the following third-party services:
            </p>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-1">
              <li>
                <strong className="text-foreground">Supabase</strong> — authentication and data
                storage
              </li>
              <li>
                <strong className="text-foreground">Google Gemini API</strong> — receipt image
                processing (images are sent to Google&apos;s API and subject to Google&apos;s
                privacy policy)
              </li>
              <li>
                <strong className="text-foreground">Twilio</strong> — SMS delivery for payment
                reminders
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">SMS Messaging</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              SMS payment reminders are only sent when a bill owner explicitly triggers them.
              Consent to receive SMS messages is required at signup. You may opt out at any time by
              replying <strong className="text-foreground">STOP</strong> to any message. Message
              and data rates may apply.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Data Retention</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is retained for as long as your account is active. To request deletion of
              your account and associated data, contact us at the address below.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Questions or requests:{' '}
              <a
                href="mailto:pnarielwala@gmail.com"
                className="text-primary underline underline-offset-4"
              >
                pnarielwala@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
