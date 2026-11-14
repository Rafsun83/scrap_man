/** Today's date in Dhaka as YYYY-MM-DD; rates and slots follow local days. */
export function dhakaToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}
