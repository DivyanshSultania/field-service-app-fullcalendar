import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const VITE_KEY = import.meta.env.VITE_API_URL;

export default function TeamManagement() {
  const [teams, setTeams] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'Active',
    supervisor_id: '',
    member_ids: []
  });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    fetch(`${VITE_KEY}/api/teams`).then(r => r.json()).then(setTeams);
    fetch(`${VITE_KEY}/api/staff`).then(r => r.json()).then(setStaff);
  }, []);

  const handleAdd = () => {
    setEditMode(false);
    setShowModal(true);
    setForm({ name: '', description: '', status: 'Active', supervisor_id: '', member_ids: [] });
  };

  const handleEdit = async (id) => {
    const res = await fetch(`${VITE_KEY}/api/teams/${id}`);
    const data = await res.json();
    setEditMode(true);
    setEditId(id);
    setShowModal(true);
    setForm({
      name: data.name,
      description: data.description || '',
      status: data.status || 'Active',
      supervisor_id: data.supervisor_id || '',
      member_ids: data.members?.map(m => m.staff_id) || []
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const url = editMode
      ? `${VITE_KEY}/api/teams/${editId}`
      : `${VITE_KEY}/api/teams`;
    const method = editMode ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    debugger;
    if (editMode) {
      setTeams(prev => prev.map(t => (t.id === editId ? data : t)));
    } else {
      setTeams(prev => [data, ...prev]);
    }
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this team?')) return;
    await fetch(`${VITE_KEY}/api/teams/${id}`, { method: 'DELETE' });
    setTeams(prev => prev.filter(t => t.id !== id));
  };

  const handleMemberToggle = (id) => {
    setForm(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(id)
        ? prev.member_ids.filter(m => m !== id)
        : [...prev.member_ids, id]
    }));
  };

  const modal = (
    <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}>
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        width: '600px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>{editMode ? 'Edit Team' : 'Add New Team'}</h2>
        
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Team Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required 
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #e6e7f0' }}
                />

                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} 
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #e6e7f0' }}
                />

                <label>Status *</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #e6e7f0' }}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>

                <label>Team Supervisor</label>
                <select
                  value={form.supervisor_id}
                  onChange={e => setForm({ ...form, supervisor_id: e.target.value })}
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #e6e7f0' }}
                >
                  <option value="">Select a supervisor</option>
                  {staff.filter(s => s.role === 'Supervisor').map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label>Team Members</label>
                <div style={{ border: '1px solid #e6e7f0', borderRadius: '8px', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {staff.filter(s => s.role !== 'supervisor').map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={form.member_ids.includes(s.id)}
                        onChange={() => handleMemberToggle(s.id)}
                      />
                      {s.name} <span style={{ color: '#888' }}>{s.role}</span>
                    </label>
                  ))}
                </div>

                {form.member_ids.length > 0 && (
                  <div style={{ marginTop: 10, background: '#f9fafb', padding: 8, borderRadius: 6 }}>
                    <strong>Selected Members ({form.member_ids.length})</strong>
                    <div>{form.member_ids.map(id => {
                      const m = staff.find(s => s.id === id);
                      return <span key={id} style={{ display: 'inline-block', background: '#eef2ff', padding: '4px 8px', margin: 4, borderRadius: 6 }}>{m?.name}</span>;
                    })}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 20 }}>
              <button type="button" className="btn" onClick={() => setShowModal(false)} style={{ background: '#e0e0e0', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" className="btn primary" style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>{editMode ? 'Update Team' : 'Create Team'}</button>
            </div>
          </form>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Teams Management</h2>
        <button className="btn primary" onClick={handleAdd} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>+ Add Team</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f9fafb', textAlign: 'left' }}>
          <tr>
            <th style={{ padding: '12px' }}>Team Name</th>
            <th style={{ padding: '12px' }}>Description</th>
            <th style={{ padding: '12px' }}>Status</th>
            <th style={{ padding: '12px' }}>Supervisor</th>
            <th style={{ padding: '12px' }}>Members</th>
            <th style={{ padding: '12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '12px' }}>{t.name}</td>
              <td style={{ padding: '12px' }}>{t.description || 'No description'}</td>
              <td style={{ padding: '12px' }}><span style={{ background: '#ECFDF5', padding: '4px 8px', borderRadius: '6px' }}>{t.status || 'Active'}</span></td>
              <td style={{ padding: '12px' }}>{t.supervisor_name || '-'}</td>
              <td style={{ padding: '12px' }}>{t.member_count || 0} member(s)</td>
              <td style={{ padding: '12px' }}>
                <button className="btn" onClick={() => handleEdit(t.id)} style={{ background: 'transparent', border: 'none', color: '#4F46E5', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }} onMouseOver={e => e.currentTarget.style.background = '#eef2ff'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>Edit</button>{' '}
                <button className="btn" style={{ color: 'red', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }} onClick={() => handleDelete(t.id)} onMouseOver={e => e.currentTarget.style.background = '#ffeaea'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && ReactDOM.createPortal(modal, document.body)}
    </div>
  );
}