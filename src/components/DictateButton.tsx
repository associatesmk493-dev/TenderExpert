import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SPEECH_LANGUAGES, useSpeechToText } from '@/hooks/useSpeechToText';

// Speech-to-text for any text box: tap, speak, tap again — the words are handed to onText.
export default function DictateButton({ onText }: { onText: (text: string) => void }) {
  const { toast } = useToast();
  const [language, setLanguage] = useState('en-IN');
  const speech = useSpeechToText(language, (message) =>
    toast({ title: 'Voice typing', description: message, variant: 'destructive' }),
  );

  const toggle = async () => {
    if (speech.listening) {
      const spoken = speech.stop();
      if (spoken) onText(spoken);
      speech.reset();
    } else {
      await speech.start();
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Voice typing language"
        className="h-9 rounded-md border bg-background px-2 text-xs"
        value={language}
        disabled={speech.listening}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {SPEECH_LANGUAGES.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <Button
        type="button"
        size="icon"
        variant={speech.listening ? 'destructive' : 'outline'}
        className={speech.listening ? 'animate-pulse' : ''}
        title={speech.listening ? 'Tap to stop and add the text' : 'Speak to type'}
        aria-label={speech.listening ? 'Stop voice typing' : 'Start voice typing'}
        onClick={toggle}
      >
        {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      {speech.listening && (
        <span className="max-w-[10rem] truncate text-xs text-muted-foreground">
          {speech.text} {speech.interim}
        </span>
      )}
    </div>
  );
}
