import React from "react";
import { fetchSalesBoardSnapshot } from "@/lib/data-service";
import { PublicSalesBoard } from "@/components/board/public-salesboard";

export const dynamic = "force-dynamic";

export default async function PublicBoardPage() {
  const initialSnapshot = await fetchSalesBoardSnapshot({ preset: "thisMonth" });

  return <PublicSalesBoard initialSnapshot={initialSnapshot} />;
}
