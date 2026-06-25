import { useNavigate } from 'react-router-dom';
import LoginScreen from '../components/LoginScreen.jsx';

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  return (
    <LoginScreen
      onLogin={onLogin}
      onRegistrar={() => navigate('/registro')}
      onRecuperar={() => navigate('/recuperar')}
    />
  );
}
