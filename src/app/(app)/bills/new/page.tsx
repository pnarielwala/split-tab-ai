import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { NewBillForm } from "@/components/bills/NewBillForm";

export default function NewBillPage() {
  return (
    <>
      <TopHeader title="New Bill" backHref="/dashboard" />
      <PageContainer>
        <NewBillForm />
      </PageContainer>
    </>
  );
}
