import { useNavigate } from 'react-router-dom';
import RegistroScreen from '../components/RegistroScreen.jsx';

export default function RegistroPage({ onRegistrado }) {
  const navigate = useNavigate();
  return (
    <RegistroScreen
      onRegistrado={(emp) => { onRegistrado(emp); navigate('/pedido', { replace: true }); }}
      onVolver={() => navigate('/login')}
    />
  );
}
