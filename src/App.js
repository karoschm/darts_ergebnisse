import './App.css';
import AppRoutes from './AppRoutes';
import { useAuth } from './context/AuthContext';

function App() {
  const { authReady } = useAuth();

  if (!authReady) return <div>Lade...</div>;

  return (
    <AppRoutes />
  );
}

export default App;
