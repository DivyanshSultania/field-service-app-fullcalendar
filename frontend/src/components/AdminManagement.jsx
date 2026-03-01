import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { authFetch } from './../pages/utils';

const VITE_KEY = import.meta.env.VITE_API_URL;

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editAdminId, setEditAdminId] = useState(null);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    password_hash: '',
  });

  useEffect(() => {
    authFetch(`${VITE_KEY}/api/admins`)
      .then(r => r.json())
      .then(setAdmins)
      .catch(err => console.error('Error loading admins', err));
  }, []);

  function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this admin?')) return;
    authFetch(`${VITE_KEY}/api/admins/${id}`, { method: 'DELETE' })
      .then(() => setAdmins(prev => prev.filter(a => a.id !== id)))
      .catch(err => console.error('Delete failed', err));
  }

  function handleAddAdminClick() {
    setEditMode(false);
    setShowModal(true);
  }

  function handleEditAdmin(admin) {
    setEditMode(true);
    setEditAdminId(admin.id);
    setNewAdmin({
      name: admin.name || '',
      email: admin.email || '',
      password_hash: '',
    });
    setShowModal(true);
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setNewAdmin(prev => ({ ...prev, [name]: value }));
  }

  function handleCancel() {
    setShowModal(false);
    setNewAdmin({
      name: '',
      email: '',
      password_hash: '',
    });
    setEditMode(false);
    setEditAdminId(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { name: newAdmin.name, email: newAdmin.email };
    if (newAdmin.password_hash) payload.password_hash = newAdmin.password_hash;

    if (editMode) {
      authFetch(`${VITE_KEY}/api/admins/${editAdminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(r => {
          if (!r.ok) throw new Error('Failed to update admin');
          return r.json();
        })
        .then(updatedAdmin => {
          setAdmins(prev => prev.map(a => (a.id === editAdminId ? updatedAdmin : a)));
          setShowModal(false);
          setNewAdmin({ name: '', email: '', password_hash: '' });
          setEditMode(false);
          setEditAdminId(null);
        })
        .catch(err => {
          console.error(err);
          alert('Failed to update admin');
        });
    } else {
      authFetch(`${VITE_KEY}/api/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(r => {
          if (!r.ok) throw new Error('Failed to add admin');
          return r.json();
        })
        .then(addedAdmin => {
          setAdmins(prev => [addedAdmin, ...prev]);
          setShowModal(false);
          setNewAdmin({ name: '', email: '', password_hash: '' });
        })
        .catch(err => {
          console.error(err);
          alert('Failed to add admin');
        });
    }
  }

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
        width: '400px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>{editMode ? 'Edit Admin' : 'Add Admin'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Name</label>
            <input
              type="text"
              name="name"
              value={newAdmin.name}
              onChange={handleInputChange}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Email</label>
            <input
              type="email"
              name="email"
              value={newAdmin.email}
              onChange={handleInputChange}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Password {editMode && '(leave blank to keep current)'}</label>
            <input
              type="password"
              name="password_hash"
              value={newAdmin.password_hash}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={handleCancel} className="btn">Cancel</button>
            <button type="submit" className="btn primary">{editMode ? 'Update Admin' : 'Add Admin'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Admin Management</h2>
        <button className="btn primary" onClick={handleAddAdminClick}>+ Add Admin</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f9fafb', textAlign: 'left' }}>
          <tr>
            <th style={{ padding: '12px' }}>Admin</th>
            <th style={{ padding: '12px' }}>Email</th>
            <th style={{ padding: '12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {admins.map(a => (
            <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    background: '#EEF2FF',
                    color: '#4F46E5',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                  }}>
                    {a.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                </div>
              </td>
              <td style={{ padding: '12px', color: '#6b7280' }}>{a.email}</td>
              <td style={{ padding: '12px' }}>
                <button className="btn" onClick={() => handleEditAdmin(a)}>Edit</button>{' '}
                <button className="btn" style={{ color: 'red' }} onClick={() => handleDelete(a.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showModal && ReactDOM.createPortal(modal, document.body)}
    </div>
  );
}
