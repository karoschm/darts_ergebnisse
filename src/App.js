import './App.css';
import { TournamentProvider } from './context/TournamentContext';
import AppRoutes from './AppRoutes';

function App() {
  return (
    <TournamentProvider>
      <AppRoutes/>
    </TournamentProvider>
  );
}

export default App;
