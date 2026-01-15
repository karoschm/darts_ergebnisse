import logo from './logo.svg';
import './App.css';
import MainPage from './pages/MainPage/MainPage';
import TournamentSetup from './components/Setup/TournamentSetup';
import { TournamentProvider } from './context/TournamentContext';
import AppRoutes from './AppRoutes';

function App() {
  return (
    <TournamentProvider>
      <AppRoutes />
    </TournamentProvider>
  );
}

// function App() {
//   return (
//     <div className="App">
//       <MainPage />
//     </div>
//   );
// }

export default App;
