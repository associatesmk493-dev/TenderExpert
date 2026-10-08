const PAGE_WIDTH = 794;
const PAGE_MIN_HEIGHT = 1123;
const SCALE = 2;

const toDataUrl = async (url: string) => {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error('Logo could not be loaded');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

// Renders the invoice HTML (see invoiceHtml) to a PNG, entirely in the browser.
// The HTML is loaded in a hidden iframe so its global CSS never touches the app.
export async function invoiceToPngBlob(html: string): Promise<Blob> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH}px;height:${PAGE_MIN_HEIGHT}px;border:0;visibility:hidden`;
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Invoice could not be rendered'));
      iframe.srcdoc = html;
    });
    const doc = iframe.contentDocument;
    const page = doc?.querySelector('.page') as HTMLElement | null;
    if (!doc || !page) throw new Error('Invoice could not be rendered');

    // Images inside an SVG-as-image cannot load remote URLs, so embed the logo.
    const logo = page.querySelector('img.logo') as HTMLImageElement | null;
    if (logo) {
      try {
        logo.src = await toDataUrl(logo.src);
        await logo.decode();
      } catch {
        logo.remove();
      }
    }

    const height = Math.max(PAGE_MIN_HEIGHT, page.scrollHeight);
    const serializer = new XMLSerializer();
    const styles = Array.from(doc.querySelectorAll('style')).map((node) => serializer.serializeToString(node)).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${styles}${serializer.serializeToString(page)}</foreignObject></svg>`;

    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Invoice image could not be created'));
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });

    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH * SCALE;
    canvas.height = height * SCALE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Invoice image could not be created');
    context.scale(SCALE, SCALE);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, PAGE_WIDTH, height);
    context.drawImage(image, 0, 0, PAGE_WIDTH, height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Invoice image could not be created'))), 'image/png'),
    );
  } finally {
    iframe.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
