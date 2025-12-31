import React, { useState } from 'react';

export default function LeftSidebar({ staff = [], clients = [], teams = [], onNavigate, onFilterChange }) {
  const [activeMenu, setActiveMenu] = useState('calendar');
  const [activeTab, setActiveTab] = useState('staff');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  function handleFilterSelect(id) {
    const updated = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    setSelectedIds(updated);
    onFilterChange(activeTab, updated);
  }

  const filteredList = {
    staff: staff.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase())),
    client: clients.filter(c => c.client_name?.toLowerCase().includes(searchTerm.toLowerCase())),
    team: teams.filter(t => t.name?.toLowerCase().includes(searchTerm.toLowerCase())),
  }[activeTab];

  return (
    <aside className="sidebar">
      <div className="menu-header">
        <button className="menu-toggle">☰</button>
        <h3 className="menu-title">MENU</h3>
      </div>

      <div className="menu">
        <div
          className={`menu-item ${activeMenu === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveMenu('profile')}
        >
          👤 User Profile
        </div>
        <div
          className={`menu-item ${activeMenu === 'supervisor' ? 'active' : ''}`}
          onClick={() => setActiveMenu('supervisor')}
        >
          🧑‍💼 Supervisor
        </div>
        <div
          className={`menu-item ${activeMenu === 'tables' ? 'active' : ''}`}
          onClick={() => {
            setActiveMenu('tables');
            onNavigate('tables');
          }}
        >
          📋 Tables
        </div>
        <div className="submenu">
          <div className="menu-item">🧹 Cleaners Roster</div>
          <div
            className={`menu-item ${activeMenu === 'staff' ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu('staff');
              onNavigate('staff');
            }}
          >
            👥 Staff Management
          </div>
          <div  className={`menu-item ${activeMenu === 'team' ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu('team');
              onNavigate('team');
            }}>🧑‍🤝‍🧑 Teams Management</div>
          <div
          className={`menu-item ${activeMenu === 'client' ? 'active' : ''}`}
          onClick={() => {
            setActiveMenu('client');
            onNavigate('client');
          }}
        >
          💼 Clients Management
        </div>
          <div className="menu-item">📅 Schedule</div>
        </div>

        <div
          className={`menu-item ${activeMenu === 'calendar' ? 'active' : ''}`}
          onClick={() => {
            setActiveMenu('calendar');
            onNavigate('calendar');
          }}
        >
          🗓️ Calendar
        </div>

        {activeMenu === 'calendar' && (
          <div className="calendar-submenu">
            <div className="filter-tabs">
              {['staff', 'client', 'team'].map(tab => (
              <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedIds([]);
                    onFilterChange(tab, []);
                  }}
              >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
              ))}
            </div>

            <input
              type="text"
              className="search"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />

            <div className="staff-list">
              {filteredList.map(item => (
                <label key={item.id} className="staff-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => handleFilterSelect(item.id)}
                    style={{ width: '20px' }}
                  />
                  <span className="dot" style={{ background: item.color || '#ddd' }}></span>
                  <span>{item.name || item.client_name}</span>
                </label>
              ))}
              {filteredList.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>No results found.</div>}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}