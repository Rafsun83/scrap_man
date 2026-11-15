/** The contract's TodayRates. */
export interface TodayRatesDto {
  effectiveDate: string;
  publishedAt: string | null;
  rates: { categoryCode: string; ratePerKg: number | null; changeFromYesterday: number | null }[];
}
