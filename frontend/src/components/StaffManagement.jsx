import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {authFetch} from './../pages/utils';


const VITE_KEY = import.meta.env.VITE_API_URL;
const BACKEND_PUBLIC_URL = VITE_KEY;

function getBackendOrigin(url) {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return String(url).replace(/\/+$/, '');
  }
}

function buildViewStaffRosterLink(staffMember) {
  if (!staffMember?.id) return '';
  debugger;
  const key1 = staffMember.roster_token1 || staffMember.key1;
  const key2 = staffMember.roster_token2;
  if (!key1 || !key2) return '';
  const params = new URLSearchParams({
    url_id: staffMember.id,
    key: key1,
    key2,
  });
  return `${getBackendOrigin(BACKEND_PUBLIC_URL)}/schedule/viewStaffRoster?${params.toString()}`;
}

function textColorForBackground(hex) {
  if (!hex || typeof hex !== 'string') return '#ffffff';
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  const n = h.slice(1);
  let r; let g; let b;
  if (n.length === 3) {
    r = parseInt(n[0] + n[0], 16);
    g = parseInt(n[1] + n[1], 16);
    b = parseInt(n[2] + n[2], 16);
  } else if (n.length === 6) {
    r = parseInt(n.slice(0, 2), 16);
    g = parseInt(n.slice(2, 4), 16);
    b = parseInt(n.slice(4, 6), 16);
  } else {
    return '#ffffff';
  }
  if ([r, g, b].some(Number.isNaN)) return '#ffffff';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#111827' : '#ffffff';
}

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editStaffId, setEditStaffId] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');
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
    authFetch(`${VITE_KEY}/api/staff`)
      .then(r => r.json())
      .then(setStaff)
      .catch(err => console.error('Error loading staff', err));
  }, []);

  function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    authFetch(`${VITE_KEY}/api/staff/${id}`, { method: 'DELETE' })
      .then(() => setStaff(prev => prev.filter(s => s.id !== id)))
      .catch(err => console.error('Delete failed', err));
  }

  function handleAddStaffClick() {
    setEditMode(false);
    setCopyFeedback('');
    setShowModal(true);
  }

  function handleEditStaff(staff) {
    setEditMode(true);
    setEditStaffId(staff.id);
    setCopyFeedback('');
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
    setCopyFeedback('');
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
      authFetch(`${VITE_KEY}/api/staff/${editStaffId}`, {
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
          setCopyFeedback('');
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
      authFetch(`${VITE_KEY}/api/staff`, {
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
          setCopyFeedback('');
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

  async function handleCopyRosterLink() {
    const currentStaff = staff.find(member => member.id === editStaffId);
    debugger;
    const rosterLink = buildViewStaffRosterLink(currentStaff);
    if (!rosterLink) {
      setCopyFeedback('Roster link unavailable');
      return;
    }

    try {
      await navigator.clipboard.writeText(rosterLink);
      setCopyFeedback('Copied');
    } catch (error) {
      console.error('Failed to copy roster link', error);
      setCopyFeedback('Copy failed');
    }
  }

  const currentEditStaff = staff.find(member => member.id === editStaffId);
  const rosterLink = editMode ? buildViewStaffRosterLink(currentEditStaff) : '';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                background: newStaff.color || '#465fff',
                color: textColorForBackground(newStaff.color || '#465fff'),
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                flexShrink: 0,
              }}>
                {newStaff.name?.trim()?.[0]?.toUpperCase() || '?'}
              </div>
              <input
                type="color"
                name="color"
                value={newStaff.color}
                onChange={handleInputChange}
                style={{ flex: 1, padding: '4px', boxSizing: 'border-box', height: '36px' }}
              />
            </div>
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
          {editMode && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>View Staff Roster Link</label>
              <button
                type="button"
                onClick={handleCopyRosterLink}
                disabled={!rosterLink}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  background: rosterLink ? '#f9fafb' : '#f3f4f6',
                  color: rosterLink ? '#1d4ed8' : '#9ca3af',
                  cursor: rosterLink ? 'pointer' : 'not-allowed',
                  textAlign: 'left',
                  wordBreak: 'break-all',
                }}
                title={rosterLink ? 'Click to copy roster link' : 'Roster link unavailable'}
              >
                {rosterLink || 'Roster link unavailable until staff keys are available'}
              </button>
              {copyFeedback && (
                <div style={{ marginTop: 6, fontSize: 12, color: copyFeedback === 'Copied' ? '#065f46' : '#b45309' }}>
                  {copyFeedback}
                </div>
              )}
            </div>
          )}
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
                    background: s.color || '#EEF2FF',
                    color: textColorForBackground(newStaff.color || '#465fff'),
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
                {/* <button className="btn">View</button>{' '} */}
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
