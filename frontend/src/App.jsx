import React, { useEffect, useState } from 'react';
import LeftSidebar from './components/LeftSidebar';
import CalendarView from './components/CalendarView';
import StaffManagement from './components/StaffManagement';
import TeamManagement from './components/TeamManagement';
import ClientsManagement from './components/ClientsManagement';

export default function App() {
  const [staff, setStaff] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState({ type: 'staff', ids: [] });
  const [view, setView] = useState('calendar'); // Default view is 'calendar'

  useEffect(() => {
    fetch('http://localhost:4000/api/staff').then(r=>r.json()).then(setStaff).catch(()=>{});
    fetch('http://localhost:4000/api/tasks').then(r=>r.json()).then(setTasks).catch(()=>{});
    fetch('http://localhost:4000/api/teams').then(r => r.json()).then(setTeams).catch(() => {});
    fetch('http://localhost:4000/api/clients').then(r => r.json()).then(setClients).catch(() => {});
  }, []);
  
  // function renderView() {
  //   switch (view) {
  //     case 'staff':
  //       return <StaffView />;
  //     case 'client':
  //       return <ClientView />;
  //     case 'team':
  //       return <TeamView />;
  //     case 'calendar':
  //     default:
  //       return <CalendarView tasks={tasks} />;
  //   }
  // }

  function renderView() {
    switch (view) {
      case 'staff':
        return <StaffManagement />;
        case 'client':
          return <ClientsManagement />;
      case 'team':
        return <TeamManagement />;
      case 'calendar':
      default:
        return <CalendarView filter={filter} />;
    }
  }

  return (
    <div className="app">
      <LeftSidebar
        staff={staff}
        clients={clients}
        teams={teams}
        onFilterChange={(type, ids) => setFilter({ type, ids })}
        onNavigate={setView} 
      />
      <main className="main">
      {renderView()}
        {/* <CalendarView tasks={tasks} /> */}
      </main>
    </div>
  );
}

function StaffView() {
  return <div>Staff Table View</div>;
}

function ClientView() {
  return <div>Client Table View</div>;
}

function TeamView() {
  return <div>Team Table View</div>;
}