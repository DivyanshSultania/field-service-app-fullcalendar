import React, { useEffect, useState } from 'react';
import LeftSidebar from './components/LeftSidebar';
import CalendarView from './components/CalendarView';
import StaffManagement from './components/StaffManagement';
import AdminManagement from './components/AdminManagement';
import TeamManagement from './components/TeamManagement';
import ClientsManagement from './components/ClientsManagement';
import Schedule from './pages/Schedule';
import Login from './pages/Login';

const VITE_KEY = import.meta.env.VITE_API_URL;

function AuthenticatedApp({ user, onLogout }) {
    const [staff, setStaff] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [teams, setTeams] = useState([]);
    const [clients, setClients] = useState([]);
    const [filter, setFilter] = useState({ type: 'staff', ids: [], hiddenDays: [] });
    const [view, setView] = useState('calendar');
  
    const token = localStorage.getItem("token");
  
    // const authFetch = function (url) {
    //     debugger;
    //     return fetch(url, {
    //       headers: {
    //         Authorization: `Bearer ${token}`
    //       }
    //     }).then(r => {
    //         debugger;
    //       if (r.status === 401) {
    //         localStorage.clear();
    //         window.location.reload();
    //       }
    //       return r.json();
    //     });
    // }

    const authFetch = async (url, options = {}) => {
        const token = localStorage.getItem("token");
      
        const res = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
          }
        });
      
        if (res.status === 401) {
          localStorage.clear();
          window.location.reload();
          throw new Error("Unauthorized");
        }
      
        return res.json();
      };
  
    useEffect(() => {
      authFetch(`${VITE_KEY}/api/staff`).then(setStaff).catch(()=>{});
      authFetch(`${VITE_KEY}/api/tasks`).then(setTasks).catch(()=>{});
      authFetch(`${VITE_KEY}/api/teams`).then(setTeams).catch(()=>{});
      authFetch(`${VITE_KEY}/api/clients`).then(setClients).catch(()=>{});
    }, []);
  
    function renderView() {
      switch (view) {
        case 'staff':
          return <StaffManagement />;
        case 'admin':
          return <AdminManagement />;
        case 'client':
          return <ClientsManagement />;
        case 'team':
          return <TeamManagement />;
        case 'schedule':
          return <Schedule />;
        default:
          return (
            <CalendarView
              filter={filter}
              onHiddenDaysChange={hiddenDays =>
                setFilter(prev => ({ ...prev, hiddenDays }))
              }
            />
          );
      }
    }
  
    return (
      <div className="app">
        <LeftSidebar
          staff={staff}
          clients={clients}
          teams={teams}
          onFilterChange={(type, ids) =>
            setFilter(prev => ({ ...prev, type, ids }))
          }
          onNavigate={setView}
        />
  
        <main className="main">
          <div style={{ textAlign: 'right', padding: '10px' }}>
            Welcome {user.name}
            <button onClick={onLogout} style={{ marginLeft: '10px' }}>
              Logout
            </button>
          </div>
  
          {renderView()}
        </main>
      </div>
    );
  }

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <AuthenticatedApp user={user} onLogout={() => {
    localStorage.clear();
    setUser(null);
  }} />;
}