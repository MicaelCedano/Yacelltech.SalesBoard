export interface PointsReport {
  startDate: string;
  endDate: string;
  storeName: string;
  generatedAt: string;
  total: number;
  sellers: { id: string; name: string; active: boolean; total: number }[];
  days: { date: string; points: Record<string, number | null>; total: number }[];
  movements: {
    date: string; sellerId: string; sellerName: string; type: string;
    points: number; previous: number; total: number; appliedAt: string; appliedBy: string;
  }[];
}
