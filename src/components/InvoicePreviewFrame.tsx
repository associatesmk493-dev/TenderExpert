import { useEffect, useRef, useState } from 'react';

const PAGE_WIDTH = 794;

// Shows the invoice exactly as it prints, scaled down to fit phones and narrow windows.
export default function InvoicePreviewFrame({ html }: { html: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(PAGE_WIDTH);
  const [height, setHeight] = useState(1123);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth || PAGE_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(1, width / PAGE_WIDTH);
  const offset = Math.max(0, (width - PAGE_WIDTH * scale) / 2);

  return (
    <div ref={wrapRef} className="w-full overflow-hidden rounded-lg bg-slate-200 ring-1 ring-slate-200" style={{ height: height * scale }}>
      <iframe
        title="Invoice preview"
        srcDoc={html}
        sandbox="allow-same-origin"
        scrolling="no"
        onLoad={(event) => {
          const page = event.currentTarget.contentDocument?.querySelector('.page') as HTMLElement | null;
          if (page) setHeight(page.scrollHeight);
        }}
        style={{ width: PAGE_WIDTH, height, border: 0, background: '#fff', transform: `scale(${scale})`, transformOrigin: 'top left', marginLeft: offset }}
      />
    </div>
  );
}
