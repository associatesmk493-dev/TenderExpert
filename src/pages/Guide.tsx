import { useNavigate } from 'react-router-dom';
import FirstTimeGuide from '@/components/FirstTimeGuide';

// Menu entry "Guide": reopens the walkthrough on demand.
export default function Guide() {
  const navigate = useNavigate();
  return <FirstTimeGuide open onClose={() => navigate('/', { replace: true })} />;
}
