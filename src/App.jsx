import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import SeniorView from './components/SeniorView';
import CaregiverView from './components/CaregiverView';
import MobileView from './components/MobileView';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="nav-links">
          <Link to="/">🛡️ Edge Device (Home)</Link>
          <Link to="/caregiver" style={{ marginLeft: '1rem' }}>💻 Dispatch Dashboard</Link>
          <Link to="/mobile/caretaker" target="_blank" style={{ marginLeft: '1rem', color: '#10b981' }}>📱 Caretaker Phone</Link>
          <Link to="/mobile/family" target="_blank" style={{ marginLeft: '1rem', color: '#3b82f6' }}>📱 Family Phone</Link>
        </nav>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<SeniorView />} />
            <Route path="/caregiver" element={<CaregiverView />} />
            <Route path="/mobile/:role" element={<MobileView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
