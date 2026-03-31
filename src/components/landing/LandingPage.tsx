import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { NavThemeToggle } from '@/components/landing/NavThemeToggle';
import { Camera, CheckSquare, Calculator, Mail, Receipt } from 'lucide-react';

export function LandingPage({ displayName }: { displayName?: string }) {
  return (
    <div className="landing min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">Split Tab AI</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <NavThemeToggle />
            </div>
            {displayName ? (
              <Button size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 text-center">
        <div className="mx-auto max-w-3xl px-6">
          {/* Pill badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary" />
            AI-Powered Receipt Splitting
          </div>

          <h1 className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Split Any Bill, <span className="text-primary">Perfectly Fair</span>
          </h1>

          <p className="mx-auto mb-8 max-w-[50ch] text-lg text-muted-foreground">
            Scan the receipt, assign items to your group, and let AI handle the
            math. Tips, taxes, and fees split proportionally — no more awkward
            bill math.
          </p>

          <div className="mb-16 flex flex-wrap items-center justify-center gap-3">
            {displayName ? (
              <Button size="lg" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link href="/signup">Get Started Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
              </>
            )}
          </div>

          {/* App mockup */}
          <div
            className="flex justify-center"
            style={{ perspective: '1200px' }}
          >
            <div className="transition-transform duration-500 ease-out hover:[transform:rotateX(10deg)_rotateY(-10deg)_scale(1.03)]">
              <Image
                src="/hero-mockup.png"
                alt="Split Tab AI app showing bill splitting in action"
                width={420}
                height={560}
                className="w-full max-w-sm drop-shadow-[0_25px_80px_rgba(0,0,0,0.35)]"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Features
          </p>
          <h2 className="mb-12 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to split bills fairly
          </h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Camera,
                title: 'AI Receipt Scanning',
                description:
                  'Take a photo of your receipt and AI instantly parses every item, price, tax, and tip — no manual entry required.',
              },
              {
                icon: CheckSquare,
                title: 'Item-by-Item Claiming',
                description:
                  'Share a link and each person claims exactly what they ordered. No guessing, no splitting evenly.',
              },
              {
                icon: Calculator,
                title: 'Proportional Cost Splitting',
                description:
                  "Tips, taxes, and fees are automatically split proportionally based on each person's share of the subtotal.",
              },
              {
                icon: Mail,
                title: 'Email Payment Reminders',
                description:
                  'Request payment from your group with a single tap. Reminders are sent by email with Venmo, Zelle, and CashApp links.',
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border bg-card p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 border-t">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-16 text-3xl font-bold tracking-tight sm:text-4xl">
            From receipt to settled in minutes
          </h2>

          <div className="grid gap-16 md:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Scan the receipt',
                description:
                  'Open the app and photograph your restaurant receipt. Our AI reads every item automatically — even handwritten receipts.',
              },
              {
                step: '2',
                title: 'Assign to your group',
                description:
                  'Share the bill link with friends. Each person opens it and taps the items they ordered.',
              },
              {
                step: '3',
                title: 'Everyone pays their share',
                description:
                  'See a breakdown of exactly what each person owes, including their proportional share of tax and tip. Request payment with one tap.',
              },
            ].map(({ step, title, description }) => (
              <div key={step}>
                <div className="mb-4 text-5xl font-bold text-primary/20 leading-none">
                  {step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-primary/5 px-8 py-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to split smarter?
            </h2>
            <p className="mb-8 text-muted-foreground">
              Join groups already using Split Tab AI to keep bills fair.
            </p>
            <Button size="lg" asChild>
              <Link href={displayName ? '/dashboard' : '/signup'}>
                {displayName ? 'Go to Dashboard' : 'Get Started Free'}
              </Link>
            </Button>
            {!displayName && (
              <p className="mt-4 text-xs text-muted-foreground">
                No credit card required
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            <span>Split Tab AI</span>
            <span>© 2026</span>
            <span>·</span>
            <span>Created by Parth Narielwala</span>
          </div>
          <div className="sm:hidden">
            <NavThemeToggle />
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
