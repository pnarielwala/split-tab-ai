import { BackButton } from '@/components/BackButton';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <BackButton />

        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective date: March 10, 2026</p>

        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Acceptance</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By accessing or using Split Tab, you agree to be bound by these Terms of Service. If
              you do not agree, please do not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What Split Tab Is</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Split Tab is a bill splitting and receipt scanning tool. It allows you to upload
              receipt images, have them parsed by AI, and split costs among a group of people.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Your Account</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are responsible for maintaining the security of your account and for all activity
              that occurs under it. You must provide accurate information when creating your
              account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Acceptable Use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You agree not to upload illegal content or use the service for any unlawful purpose.
              You agree not to abuse or misuse the SMS reminder system, including attempting to
              send messages to people who have not consented.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Receipt Uploads</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are responsible for the content you upload. Receipt images are sent to Google
              Gemini AI for processing and stored in our infrastructure. Do not upload images
              containing sensitive personal information beyond what is needed for bill splitting.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">SMS Reminders</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By signing up, you consented to receive SMS payment reminders. You may opt out at
              any time by replying <strong className="text-foreground">STOP</strong> to any
              message. Message and data rates may apply.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">No Warranty</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The service is provided &quot;as is&quot; without warranty of any kind. We do not
              guarantee that the service will be error-free, uninterrupted, or that AI-parsed
              receipt data will be accurate.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Split Tab and its operators shall not be
              liable for any indirect, incidental, or consequential damages arising from your use
              of the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Changes to Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these terms from time to time. Continued use of the service after
              changes are posted constitutes your acceptance of the updated terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Questions:{' '}
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
