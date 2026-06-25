import { useNavigate } from 'react-router-dom';
import RecuperarPassword from '../components/RecuperarPassword.jsx';

export default function RecuperarPage() {
  const navigate = useNavigate();
  return (
    <RecuperarPassword
      onVolver={() => navigate('/login')}
      onExito={() => navigate('/login')}
    />
  );
}
