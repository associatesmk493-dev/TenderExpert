import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import FirstTimeGuide from '@/components/FirstTimeGuide';

// Opens the guide the first time someone signs in on this browser. It can be reopened from the menu (Guide).
export default function GuideAuto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const key = user ? `tenderexpert_guide_seen_${user.id}` : '';

  useEffect(() => {
    if (!key) return;
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      /* storage blocked: skip the automatic guide */
    }
  }, [key]);

  const close = () => {
    setOpen(false);
    navigate('/', { replace: true });
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  };
  return <FirstTimeGuide open={open} onClose={close} />;
}
