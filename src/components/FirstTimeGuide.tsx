import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeIndianRupee, ClipboardList, FileText, Landmark, Megaphone, Pause, Play, Sparkles, Users, Volume2, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Lang = 'en' | 'hi';
type T = Record<Lang, string>;
type Item = { title: T; text: T };
type Slide = {
  icon: LucideIcon;
  gradient: string;
  eyebrow: T;
  title: T;
  subtitle: T;
  tags: T[];
  kind: 'steps' | 'tiles' | 'chips';
  items: Item[];
};

const t = (en: string, hi: string): T => ({ en, hi });

const SLIDES: Slide[] = [
  {
    icon: Sparkles,
    gradient: 'from-indigo-600 via-violet-600 to-fuchsia-600',
    eyebrow: t('Welcome', 'स्वागत है'),
    title: t('TenderExpert in one minute', 'एक मिनट में TenderExpert'),
    subtitle: t('One place for leads, tenders, invoices and payments.', 'लीड, टेंडर, इनवॉइस और पेमेंट — सब एक जगह।'),
    tags: [t('Leads', 'लीड'), t('Tenders', 'टेंडर'), t('Invoices', 'इनवॉइस'), t('Payments', 'पेमेंट')],
    kind: 'steps',
    items: [
      { title: t('Capture the lead', 'लीड जोड़ें'), text: t('Add it by hand, import an Excel, or pick it from a campaign.', 'हाथ से जोड़ें, Excel इम्पोर्ट करें या कैंपेन से चुनें।') },
      { title: t('Work the opportunity', 'अवसर पर काम करें'), text: t('Move it through stages, add contacts, notes and follow-ups.', 'स्टेज बदलें, कॉन्टैक्ट, नोट्स और फॉलो-अप जोड़ें।') },
      { title: t('Quote and invoice', 'कोटेशन और इनवॉइस'), text: t('Send the proposal, raise a proforma invoice, then the tax invoice.', 'प्रपोज़ल भेजें, प्रोफॉर्मा इनवॉइस फिर टैक्स इनवॉइस बनाएँ।') },
      { title: t('Collect the money', 'पैसा वसूलें'), text: t('Track what is received, due and overdue in one dashboard.', 'क्या मिला, क्या बाकी और क्या लेट है — एक डैशबोर्ड में।') },
    ],
  },
  {
    icon: Megaphone,
    gradient: 'from-sky-600 via-cyan-600 to-teal-500',
    eyebrow: t('Leads & campaigns', 'लीड और कैंपेन'),
    title: t('Bring leads in', 'लीड अंदर लाएँ'),
    subtitle: t('Import a sheet once; the app reads phone numbers, contacts and dates for you.', 'शीट एक बार इम्पोर्ट करें; फोन, कॉन्टैक्ट और तारीखें ऐप खुद पढ़ लेता है।'),
    tags: [t('Import', 'इम्पोर्ट'), t('Export', 'एक्सपोर्ट'), t('Campaigns', 'कैंपेन')],
    kind: 'steps',
    items: [
      { title: t('Download the sample', 'सैंपल डाउनलोड करें'), text: t('It has every field of Add opportunity. Fill it and upload.', 'इसमें Add opportunity के सभी फील्ड हैं। भरें और अपलोड करें।') },
      { title: t('Campaign leads stay in Campaigns', 'कैंपेन की लीड कैंपेन में रहती हैं'), text: t('Mark one Interested and it moves into Leads.', 'Interested करते ही वह Leads में आ जाती है।') },
      { title: t('Export any time', 'कभी भी एक्सपोर्ट करें'), text: t('The exported file can be edited and imported back.', 'एक्सपोर्ट की फाइल एडिट करके वापस इम्पोर्ट हो सकती है।') },
    ],
  },
  {
    icon: Users,
    gradient: 'from-emerald-600 via-green-600 to-lime-500',
    eyebrow: t('Opportunity', 'अवसर'),
    title: t('Inside an opportunity', 'अवसर के अंदर'),
    subtitle: t('Everything about one client on one page.', 'एक क्लाइंट की पूरी जानकारी एक पेज पर।'),
    tags: [t('Stages', 'स्टेज'), t('Contacts', 'कॉन्टैक्ट'), t('Go-ahead', 'गो-अहेड')],
    kind: 'tiles',
    items: [
      { title: t('Any stage, any order', 'कोई भी स्टेज, किसी भी क्रम में'), text: t('Documents often arrive later, so stages are not locked.', 'डॉक्यूमेंट बाद में भी आते हैं, इसलिए स्टेज लॉक नहीं हैं।') },
      { title: t('Client go-ahead', 'क्लाइंट की हाँ'), text: t('Expected revenue stays zero until the client agrees an amount.', 'क्लाइंट राशि तय करे तभी Expected revenue बनता है।') },
      { title: t('People in the company', 'कंपनी के लोग'), text: t('Add every contact with designation, phone and email.', 'हर कॉन्टैक्ट को पद, फोन और ईमेल के साथ जोड़ें।') },
      { title: t('GST once', 'GST एक बार'), text: t('Save the client GST on the lead; invoices pick it up.', 'लीड में क्लाइंट का GST रखें; इनवॉइस अपने आप ले लेगा।') },
    ],
  },
  {
    icon: ClipboardList,
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    eyebrow: t('Follow-ups', 'फॉलो-अप'),
    title: t('Never miss a follow-up', 'कोई फॉलो-अप न छूटे'),
    subtitle: t('Say what is to be done, who does it and when.', 'क्या करना है, कौन करेगा और कब — बस यह लिखें।'),
    tags: [t('Tasks', 'टास्क'), t('Reminders', 'रिमाइंडर'), t('Voice notes', 'वॉइस नोट')],
    kind: 'steps',
    items: [
      { title: t('Assign it', 'असाइन करें'), text: t('Pick the person, date and time; it appears in their Tasks.', 'व्यक्ति, तारीख और समय चुनें; उनके Tasks में दिखेगा।') },
      { title: t('Log the call', 'कॉल दर्ज करें'), text: t('Record the outcome and set the next follow-up in one step.', 'नतीजा दर्ज करें और अगला फॉलो-अप साथ में सेट करें।') },
      { title: t('Speak instead of typing', 'टाइप करने की जगह बोलें'), text: t('Use the mic to dictate notes and meeting records.', 'माइक से नोट्स और मीटिंग रिकॉर्ड बोलकर लिखें।') },
    ],
  },
  {
    icon: FileText,
    gradient: 'from-blue-700 via-indigo-700 to-slate-700',
    eyebrow: t('Proposals & invoices', 'प्रपोज़ल और इनवॉइस'),
    title: t('Quote, invoice, send', 'कोटेशन, इनवॉइस, भेजें'),
    subtitle: t('A4-ready invoices with your company and the client GST.', 'आपकी कंपनी और क्लाइंट के GST के साथ A4 इनवॉइस।'),
    tags: [t('Proposal', 'प्रपोज़ल'), t('Proforma', 'प्रोफॉर्मा'), t('Tax invoice', 'टैक्स इनवॉइस')],
    kind: 'chips',
    items: [
      { title: t('Generate PI', 'PI बनाएँ'), text: t('Move the lead to Generate PI and the client details fill in.', 'लीड को Generate PI स्टेज पर लाएँ, क्लाइंट की जानकारी भर जाती है।') },
      { title: t('Tax invoice from PI', 'PI से टैक्स इनवॉइस'), text: t('One click converts a proforma into a tax invoice.', 'एक क्लिक में प्रोफॉर्मा टैक्स इनवॉइस बन जाता है।') },
      { title: t('Share as image', 'इमेज के रूप में भेजें'), text: t('Send on WhatsApp or email as a clean image.', 'WhatsApp या ईमेल पर साफ इमेज की तरह भेजें।') },
    ],
  },
  {
    icon: Landmark,
    gradient: 'from-purple-700 via-fuchsia-700 to-pink-600',
    eyebrow: t('Tender opportunities', 'टेंडर अवसर'),
    title: t('Run each site like a project', 'हर साइट को प्रोजेक्ट की तरह चलाएँ'),
    subtitle: t('Stage, parties, BOQ, department notes and our success fee together.', 'स्टेज, पार्टियाँ, BOQ, विभाग नोट्स और हमारी सक्सेस फीस साथ में।'),
    tags: [t('Stage', 'स्टेज'), t('BOQ', 'BOQ'), t('Success fee', 'सक्सेस फीस')],
    kind: 'steps',
    items: [
      { title: t('Set the stage', 'स्टेज तय करें'), text: t('From BOQ submitted to payment received by the company.', 'BOQ सबमिट से लेकर कंपनी को पेमेंट मिलने तक।') },
      { title: t('BOQ with rate and amount', 'रेट और अमाउंट के साथ BOQ'), text: t('Quantity times rate is worked out; the total feeds the calculations.', 'मात्रा × रेट अपने आप; कुल राशि कैलकुलेशन में जाती है।') },
      { title: t('Department notes', 'विभाग नोट्स'), text: t('Log what you asked, submitted, and what feedback came.', 'क्या माँगा, क्या जमा किया और क्या फीडबैक आया — दर्ज करें।') },
      { title: t('Success fee', 'सक्सेस फीस'), text: t('Add instalments with triggers; reminders are created for due fees.', 'शर्तों के साथ किश्तें जोड़ें; देय फीस के रिमाइंडर बनते हैं।') },
    ],
  },
  {
    icon: BadgeIndianRupee,
    gradient: 'from-teal-700 via-emerald-700 to-green-600',
    eyebrow: t('Money', 'पैसा'),
    title: t('See what is due', 'देखें क्या बाकी है'),
    subtitle: t('Dashboard and collections show received, to collect and overdue.', 'डैशबोर्ड और कलेक्शन में मिला, वसूलना और लेट सब दिखता है।'),
    tags: [t('Dashboard', 'डैशबोर्ड'), t('Collections', 'कलेक्शन')],
    kind: 'tiles',
    items: [
      { title: t('Received', 'मिला'), text: t('Payments already in.', 'जो पेमेंट आ चुका है।') },
      { title: t('To collect', 'वसूलना है'), text: t('Agreed and earned, not yet paid.', 'तय और कमाया हुआ, अभी बाकी।') },
      { title: t('Overdue', 'लेट'), text: t('Past the follow-up date; chase these first.', 'फॉलो-अप तारीख निकल गई; पहले इन्हें देखें।') },
      { title: t('Reminders', 'रिमाइंडर'), text: t('Due fees appear in Tasks & reminders automatically.', 'देय फीस Tasks & reminders में अपने आप आती है।') },
    ],
  },
];

const narrationOf = (slide: Slide, lang: Lang) =>
  [slide.title[lang], slide.subtitle[lang], ...slide.items.map((item) => `${item.title[lang]}. ${item.text[lang]}`)].join('. ');

const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Full-screen, swipeable first-time guide with an optional Hindi / English voice-over.
export default function FirstTimeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [lang, setLang] = useState<Lang>('en');
  const [playing, setPlaying] = useState(false);
  const [charIndex, setCharIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const last = SLIDES.length - 1;
  const slide = SLIDES[index];
  const narration = useMemo(() => narrationOf(slide, lang), [slide, lang]);

  const close = useCallback(() => {
    if (speechSupported) window.speechSynthesis.cancel();
    setPlaying(false);
    setIndex(0);
    onClose();
  }, [onClose]);

  const go = useCallback((next: number) => {
    setCharIndex(0);
    setIndex(Math.max(0, Math.min(last, next)));
  }, [last]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(index + 1);
      if (event.key === 'ArrowLeft') go(index - 1);
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, go, close]);

  // Voice-over: reads the current card; when it ends, moves on to the next one while "playing".
  useEffect(() => {
    if (!open || !speechSupported) return;
    const synth = window.speechSynthesis;
    if (!playing) {
      synth.cancel();
      return;
    }
    let active = true;
    const utterance = new SpeechSynthesisUtterance(narration);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    const voices = synth.getVoices();
    const prefix = lang === 'hi' ? 'hi' : 'en-in';
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || (lang === 'en' ? voices.find((v) => v.lang.toLowerCase().startsWith('en')) : undefined);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.onboundary = (event) => active && setCharIndex(event.charIndex);
    utterance.onend = () => {
      if (!active) return;
      setCharIndex(narration.length);
      if (index < last) go(index + 1);
      else setPlaying(false);
    };
    utterance.onerror = () => active && setPlaying(false);
    synth.cancel();
    synth.speak(utterance);
    return () => {
      active = false;
      synth.cancel();
    };
  }, [open, playing, index, lang, narration, last, go]);

  if (!open) return null;

  const sentences = narration.split(/(?<=[.।?!])\s+/);
  let offset = 0;
  const caption = sentences.find((sentence) => {
    offset += sentence.length + 1;
    return charIndex < offset;
  }) || sentences[0];
  const progress = ((index + (playing && narration.length ? Math.min(1, charIndex / narration.length) : 0)) / SLIDES.length) * 100;
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="First-time guide">
      <div
        className="flex h-full max-h-[760px] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
        onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (touchX.current === null) return;
          const dx = event.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div className="relative flex shrink-0 items-center justify-center px-12 py-3">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Guide cards">
            {SLIDES.map((_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === index} aria-label={`Card ${i + 1}`} onClick={() => go(i)} className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-2 bg-slate-300'}`} />
            ))}
          </div>
          <button type="button" aria-label="Close guide" onClick={close} className="absolute right-3 top-2.5 rounded-full p-1.5 text-muted-foreground hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[2fr_3fr] md:grid-rows-1">
          <div className={`flex flex-col justify-center gap-2 bg-gradient-to-br ${slide.gradient} p-4 text-white md:gap-3 md:p-8`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 shadow-lg md:h-14 md:w-14">
              <Icon className="h-6 w-6 text-slate-800 md:h-7 md:w-7" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">{slide.eyebrow[lang]}</p>
            <h2 className="text-xl font-extrabold leading-tight md:text-3xl">{slide.title[lang]}</h2>
            <p className="text-sm text-white/90 md:text-base">{slide.subtitle[lang]}</p>
            <div className="mt-1 hidden flex-wrap gap-1.5 md:flex">
              {slide.tags.map((tag, i) => (
                <span key={i} className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">{tag[lang]}</span>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-4 md:p-8">
            {slide.kind === 'steps' && (
              <ol className="space-y-4">
                {slide.items.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold">{item.title[lang]}</p>
                      <p className="text-sm text-muted-foreground">{item.text[lang]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {slide.kind === 'tiles' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {slide.items.map((item, i) => (
                  <div key={i} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-base font-bold">{item.title[lang]}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.text[lang]}</p>
                  </div>
                ))}
              </div>
            )}
            {slide.kind === 'chips' && (
              <div className="space-y-4">
                {slide.items.map((item, i) => (
                  <div key={i}>
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{item.title[lang]}</span>
                    <p className="mt-1.5 text-sm text-muted-foreground">{item.text[lang]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t bg-slate-50 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0 rounded-full" disabled={!speechSupported} aria-label={playing ? 'Pause voice-over' : 'Play voice-over'} title={speechSupported ? undefined : 'Voice-over is not supported in this browser'} onClick={() => setPlaying((value) => !value)}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex shrink-0 overflow-hidden rounded-full border bg-white text-xs font-semibold">
              {(['hi', 'en'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setLang(value)} className={`px-2.5 py-1.5 ${lang === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                  {value === 'hi' ? 'हिन्दी' : 'English'}
                </button>
              ))}
            </div>
            <p className="line-clamp-2 min-w-0 flex-1 text-xs text-muted-foreground" aria-live="polite">
              <Volume2 className="mr-1 inline h-3 w-3" />
              {caption}
            </p>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <Button type="button" variant="ghost" disabled={index === 0} onClick={() => go(index - 1)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <span className="text-xs text-muted-foreground">{index + 1} / {SLIDES.length}</span>
            {index === last ? (
              <Button type="button" onClick={close}>Get started</Button>
            ) : (
              <Button type="button" onClick={() => go(index + 1)}>
                Next
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
