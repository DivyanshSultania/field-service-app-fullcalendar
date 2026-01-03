
import React, { useEffect, useState } from 'react';

const VITE_KEY = import.meta.env.VITE_API_URL;


export default function ScheduleFilters({ filters, setFilters, onSearch }) {
  const [staffs, setStaffs] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    fetch(`${VITE_KEY}/api/staff`)
      .then(r => r.json())
      .then(setStaffs)
      .catch(() => {});

    fetch(`${VITE_KEY}/api/clients`)
      .then(r => r.json())
      .then(setClients)
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        width: 280,
        padding: 20,
        borderRight: '1px solid #e5e7eb',
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}
    >
      <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>
        Search
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, color: '#374151' }}>From</label>
        <input
          type="date"
          value={filters.from}
          onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #d1d5db'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, color: '#374151' }}>To</label>
        <input
          type="date"
          value={filters.to}
          onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #d1d5db'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, color: '#374151' }}>Staff</label>
        <select
          value={filters.staffId}
          onChange={e => setFilters(f => ({ ...f, staffId: e.target.value }))}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#fff'
          }}
        >
          <option value="">All Staff</option>
          {staffs.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, color: '#374151' }}>Client</label>
        <select
          value={filters.clientId}
          onChange={e => setFilters(f => ({ ...f, clientId: e.target.value }))}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#fff'
          }}
        >
          <option value="">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.client_name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, color: '#374151' }}>View</label>
        <select
          value={filters.viewType}
          onChange={e => setFilters(f => ({ ...f, viewType: e.target.value }))}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#fff'
          }}
        >
          <option value="individual">Individual</option>
          <option value="staff">Group By Staff</option>
          <option value="client">Group By Client</option>
        </select>
      </div>

      <button
        style={{
          marginTop: 16,
          padding: '10px',
          borderRadius: 8,
          border: 'none',
          background: '#4f46e5',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer'
        }}
        onClick={onSearch}
      >
        Search
      </button>
    </div>
  );
}