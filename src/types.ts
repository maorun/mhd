export interface Product {
  id: string;
  name: string;
  expiryDate: string; // ISO date string YYYY-MM-DD
  notifyDaysBefore: number;
  notified: boolean;
}
