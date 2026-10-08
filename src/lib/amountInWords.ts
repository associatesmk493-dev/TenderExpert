const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const underThousand = (n: number): string => {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ones[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ones[n]);
  }
  return parts.join(' ');
};

const wholeNumberInWords = (n: number): string => {
  if (n === 0) return 'Zero';
  const units: [number, string][] = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']];
  const parts: string[] = [];
  for (const [size, label] of units) {
    if (n >= size) {
      parts.push(`${wholeNumberInWords(Math.floor(n / size))} ${label}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(underThousand(n));
  return parts.join(' ');
};

export function amountInWords(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  let rupees = Math.floor(safe);
  let paise = Math.round((safe - rupees) * 100);
  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }
  let words = `Rupees ${wholeNumberInWords(rupees)}`;
  if (paise > 0) words += ` and ${wholeNumberInWords(paise)} Paise`;
  return `${words} Only`;
}
