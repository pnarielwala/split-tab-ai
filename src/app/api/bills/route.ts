import { NextResponse } from "next/server";
import { getDashboardBills } from "@/app/actions/queries";

export async function GET() {
  const bills = await getDashboardBills();
  return NextResponse.json(bills);
}
