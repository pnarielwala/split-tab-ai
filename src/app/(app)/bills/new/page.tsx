import { createPlaceholderBill } from "@/app/actions/bills";

export default async function NewBillPage() {
  const result = await createPlaceholderBill();
  // Happy path: redirect() is thrown inside, never reaches here
  // Error path only:
  if (result?.error) {
    return <p className="p-4 text-destructive">{result.error}</p>;
  }
}
