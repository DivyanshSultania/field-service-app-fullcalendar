import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const VITE_KEY = import.meta.env.VITE_API_URL;

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editStaffId, setEditStaffId] = useState(null);
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    password_hash: '',
    status: 'Active',
    color: '#465fff',
  });

  useEffect(() => {
    fetch(`${VITE_KEY}/api/staff`)
      .then(r => r.json())
      .then(setStaff)
      .catch(err => console.error('Error loading staff', err));
  }, []);

  function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    fetch(`${VITE_KEY}/api/staff/${id}`, { method: 'DELETE' })
      .then(() => setStaff(prev => prev.filter(s => s.id !== id)))
      .catch(err => console.error('Delete failed', err));
  }

  function handleAddStaffClick() {
    setEditMode(false);
    setShowModal(true);
  }

  function handleEditStaff(staff) {
    setEditMode(true);
    setEditStaffId(staff.id);
    setNewStaff({
      name: staff.name || '',
      email: staff.email || '',
      phone: staff.phone || '',
      role: staff.role || '',
      password_hash: '',
      status: staff.status || 'Active',
      color: staff.color || '#465fff',
    });
    setShowModal(true);
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setNewStaff(prev => ({ ...prev, [name]: value }));
  }

  function handleCancel() {
    setShowModal(false);
    setNewStaff({
      name: '',
      email: '',
      phone: '',
      role: '',
      password_hash: '',
      status: 'Active',
      color: '#465fff',
    });
    setEditMode(false);
    setEditStaffId(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (editMode) {
      fetch(`${VITE_KEY}/api/staff/${editStaffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff),
      })
        .then(r => {
          if (!r.ok) throw new Error('Failed to update staff');
          return r.json();
        })
        .then(updatedStaff => {
          setStaff(prev => prev.map(s => (s.id === editStaffId ? updatedStaff : s)));
          setShowModal(false);
          setNewStaff({
            name: '',
            email: '',
            phone: '',
            role: '',
            password_hash: '',
            status: 'Active',
            color: '#465fff',
          });
          setEditMode(false);
          setEditStaffId(null);
        })
        .catch(err => {
          console.error(err);
          alert('Failed to update staff member');
        });
    } else {
      fetch(`${VITE_KEY}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff),
      })
        .then(r => {
          if (!r.ok) throw new Error('Failed to add staff');
          return r.json();
        })
        .then(addedStaff => {
          setStaff(prev => [addedStaff, ...prev]);
          setShowModal(false);
          setNewStaff({
            name: '',
            email: '',
            phone: '',
            role: '',
            password_hash: '',
            status: 'Active',
            color: '#465fff',
          });
        })
        .catch(err => {
          console.error(err);
          alert('Failed to add staff member');
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
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>{editMode ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Name</label>
            <input
              type="text"
              name="name"
              value={newStaff.name}
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
              value={newStaff.email}
              onChange={handleInputChange}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Phone</label>
            <input
              type="text"
              name="phone"
              value={newStaff.phone}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Staff Color</label>
            <input
              type="color"
              name="color"
              value={newStaff.color}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '4px', boxSizing: 'border-box', height: '36px' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Role</label>
            <select
              name="role"
              value={newStaff.role}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            >
              <option value="Cleaner">Cleaner</option>
              <option value="Supervisor">Supervisor</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Password</label>
            <input
              type="password"
              name="password_hash"
              value={newStaff.password_hash}
              onChange={handleInputChange}
              // required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Status</label>
            <select
              name="status"
              value={newStaff.status}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={handleCancel} className="btn">Cancel</button>
            <button type="submit" className="btn primary">{editMode ? 'Update Staff Member' : 'Add Staff Member'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Staff Management</h2>
        <button className="btn primary" onClick={handleAddStaffClick}>+ Add Staff Member</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f9fafb', textAlign: 'left' }}>
          <tr>
            <th style={{ padding: '12px' }}>Staff Member</th>
            <th style={{ padding: '12px' }}>Role</th>
            <th style={{ padding: '12px' }}>Contact</th>
            <th style={{ padding: '12px' }}>Status</th>
            <th style={{ padding: '12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
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
                    {s.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{s.email}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  background: s.role === 'Supervisor' ? '#FFF7ED' : '#ECFDF5',
                  color: s.role === 'Supervisor' ? '#C2410C' : '#065F46',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: 12,
                }}>
                  {s.role || 'Cleaner'}
                </span>
              </td>
              <td style={{ padding: '12px' }}>{s.phone || 'No phone'}</td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  background: '#ECFDF5',
                  color: '#065F46',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: 12,
                }}>{s.status || 'Active'}</span>
              </td>
              <td style={{ padding: '12px' }}>
                <button className="btn">View</button>{' '}
                <button className="btn" onClick={() => handleEditStaff(s)}>Edit</button>{' '}
                <button className="btn" style={{ color: 'red' }} onClick={() => handleDelete(s.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showModal && ReactDOM.createPortal(modal, document.body)}
    </div>
  );
}