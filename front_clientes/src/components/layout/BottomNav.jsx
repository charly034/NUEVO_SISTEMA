import { NavLink } from 'react-router-dom';
import styles from './BottomNav.module.css';

const NAV = [
  { to: '/pedido',   icon: '🍽️',  label: 'Pedido' },
  { to: '/historial', icon: '📋', label: 'Mis pedidos' },
  { to: '/perfil',   icon: '👤',  label: 'Mi cuenta' },
];

export default function BottomNav() {
  return (
    <nav className={styles.bar}>
      {NAV.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${styles.btn}${isActive ? ` ${styles.btnActivo}` : ''}`
          }
        >
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
