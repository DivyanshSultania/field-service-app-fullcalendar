import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

export default function ClientsManagement() {
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [form, setForm] = useState({
    client_name: '',
    company: '',
    email: '',
    phone: '',
    abn: '',
    acn: '',
    client_instruction: '',
    client_information: '',
    property_information: '',
  });

  // Fetch all clients
  useEffect(() => {
    fetch('http://localhost:4000/api/clients')
      .then(r => r.json())
      .then(setClients)
      .catch(err => console.error('Error loading clients', err));
  }, []);

  const openAddModal = () => {
    setEditMode(false);
    setForm({
      client_name: '',
      company: '',
      email: '',
      phone: '',
      abn: '',
      acn: '',
      client_instruction: '',
      client_information: '',
      property_information: '',
    });
    setShowModal(true);
  };

  const openEditModal = (client) => {
    setEditMode(true);
    setSelectedClient(client);
    setForm({
      client_name: client.client_name || '',
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      abn: client.abn || '',
      acn: client.acn || '',
      client_instruction: client.client_instruction || '',
      client_information: client.client_information || '',
      property_information: client.property_information || '',
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const url = editMode
      ? `http://localhost:4000/api/clients/${selectedClient.id}`
      : `http://localhost:4000/api/clients`;
    const method = editMode ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then(r => r.json())
      .then(data => {
        if (editMode) {
          setClients(prev => prev.map(c => (c.id === data.id ? data : c)));
        } else {
          setClients(prev => [data, ...prev]);
        }
        setShowModal(false);
      })
      .catch(err => console.error('Save failed', err));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this client?')) return;
    fetch(`http://localhost:4000/api/clients/${id}`, { method: 'DELETE' })
      .then(() => setClients(prev => prev.filter(c => c.id !== id)))
      .catch(err => console.error('Delete failed', err));
  };

  const modal = (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="client-modal">
        <h2>{editMode ? 'Edit Client' : 'Add New Client'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label>Client Name*</label>
              <input name="client_name" value={form.client_name} onChange={handleChange} required />
            </div>
            <div>
              <label>Company</label>
              <input name="company" value={form.company} onChange={handleChange} />
            </div>
            <div>
              <label>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} />
            </div>
            <div>
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </div>
          </div>

          <h4>Business Details</h4>
          <div className="form-grid">
            <div>
              <label>ABN (Australian Business Number)</label>
              <input name="abn" value={form.abn} onChange={handleChange} />
            </div>
            <div>
              <label>ACN (Australian Company Number)</label>
              <input name="acn" value={form.acn} onChange={handleChange} />
            </div>
          </div>

          <label>Client Instruction</label>
          <textarea name="client_instruction" value={form.client_instruction} onChange={handleChange}></textarea>
          <label>Client Information</label>
          <textarea name="client_information" value={form.client_information} onChange={handleChange}></textarea>
          <label>Property Information</label>
          <textarea name="property_information" value={form.property_information} onChange={handleChange}></textarea>

          <div className="modal-actions">
            <button type="button" className="btn cancel" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn primary">{editMode ? 'Update Client' : 'Create Client'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Clients Management</h2>
        <button className="btn primary" onClick={openAddModal}>+ Add Client</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr>
            <th style={{ padding: 12 }}>Client Name</th>
            <th style={{ padding: 12 }}>Contact</th>
            <th style={{ padding: 12 }}>Company</th>
            <th style={{ padding: 12 }}>Business Details</th>
            <th style={{ padding: 12 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: 12 }}>
                <b>{c.client_name}</b>
              </td>
              <td style={{ padding: 12 }}>
                {c.email}<br />{c.phone || 'No phone'}
              </td>
              <td style={{ padding: 12 }}>{c.company || 'No company'}</td>
              <td style={{ padding: 12 }}>
                {(c.abn || c.acn) ? (
                  <>
                    {c.abn && <div>ABN: {c.abn}</div>}
                    {c.acn && <div>ACN: {c.acn}</div>}
                  </>
                ) : (c.client_information && <div>{c.client_information}</div>)}
              </td>
              <td style={{ padding: 12 }}>
                <button className="btn" onClick={() => openEditModal(c)}>Edit</button>{' '}
                <button className="btn" style={{ color: 'red' }} onClick={() => handleDelete(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && ReactDOM.createPortal(modal, document.body)}
    </div>
  );
}