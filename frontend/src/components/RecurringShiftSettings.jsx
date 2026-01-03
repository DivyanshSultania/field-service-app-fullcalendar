import React, { useState, useEffect, act, useRef } from "react";
import dayjs from "dayjs";
import Modal from './Modal';
import { GOOGLE_MAPS_API_KEY, loadGoogleMapsApi } from '../utils/googleMaps';

const DAYS = [
  { key: "M", value: 1 },
  { key: "T", value: 2 },
  { key: "W", value: 3 },
  { key: "Th", value: 4 },
  { key: "F", value: 5 },
  { key: "Sa", value: 6 },
  { key: "Su", value: 0 }
];

const VITE_KEY = import.meta.env.VITE_API_URL;

export default function RecurringShiftSettings({ task }) {
  const [frequency, setFrequency] = useState(1);
  const [selectedDays, setSelectedDays] = useState([]);
  const [occurrences, setOccurrences] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [loading, setLoading] = useState(false);

  const [childTasks, setChildTasks] = useState([]);

  // New state for recurring settings and selected ids
  const [recurringSettings, setRecurringSettings] = useState([]);
  const [selectedRecurringIds, setSelectedRecurringIds] = useState([]);

  // Dropdown state for recurring pattern actions
  const [selectedPatternAction, setSelectedPatternAction] = useState("");

  // Loader state for dropping recurring patterns
  // const [isDropping, setIsDropping] = useState(false);

  // Inline edit modal state for child tasks (kept in state if needed later)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState(null);

  // DB Fetched Values
  const [teams, setTeams] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Team selection Modal States
  const [selectedTeam, setSelectedTeam] = useState({});
  const [supervisorId, setSupervisorId] = useState(null);
  const [teamManageCleaners, setTeamManageCleaners] = useState([]);
  const [editTaskStaffModalOpen, setEditTaskStaffModalOpen] = useState(false);

  // Manage staff Modal states
  const [manageStaffModalSupervisor, setManageStaffModalSupervisor] = useState(null);
  const [manageStaffModalCleaners, setManageStaffModalCleaners] = useState([]);
  const [manageStaffModalOpen, setManageStaffModalOpen] = useState(false);


  // Location Modal States
  const [locationSearchText, setLocationSearchText] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState([]);
  const [selectedLocationPlace, setSelectedLocationPlace] = useState(null);
  const [locationUnitNo, setLocationUnitNo] = useState('');
  const [locationComment, setlocationComment] = useState('');
  const [locationRadiusMeter, setLocationRadiusMeter] = useState(100);
  const [locationMapLoaded, setLocationMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [locationLoadingDelete, setLocationLoadingDelete] = useState({});
  const [locationModalOpen, setLocationModalOpen] = useState(false);


  // Client update modal
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    task_client_name: '',
    task_client_company: '',
    task_client_email: '',
    task_client_phone: '',
    task_client_abn: '',
    task_client_acn: '',
    task_client_instruction: '',
    task_client_information: '',
    task_client_property_information: ''
  });
  const [selectedClientId, setSelectedClientId] = useState('');

  // States for 
  const [timeLengthModalOpen, setTimeLengthModalOpen] = useState(false);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");

  // Mutually exclusive fields
  useEffect(() => {
    if (occurrences) setCloseDate("");
  }, [occurrences]);

  useEffect(() => {
    if (closeDate) setOccurrences("");
  }, [closeDate]);

  const toggleDay = (value) => {
    if (selectedDays.includes(value)) {
      setSelectedDays(selectedDays.filter((d) => d !== value));
    } else {
      setSelectedDays([...selectedDays, value]);
    }
  };

  // Fetch teams, staff, clients, locations
  useEffect(() => {
    fetch(`${VITE_KEY}/api/teams`).then(r => r.json()).then(setTeams).catch(() => {});
    fetch(`${VITE_KEY}/api/staff`).then(r => r.json()).then(setStaffs).catch(() => {});
    fetch(`${VITE_KEY}/api/clients`).then(r => r.json()).then(setClients).catch(() => {});
    fetch(`${VITE_KEY}/api/locations`).then(r => r.json()).then(setLocations).catch(() => {});
    fetch(`${VITE_KEY}/api/team_members`).then(r => r.json()).then(setTeamMembers).catch(() => {});
    // fetch(`${VITE_KEY}/api/tasks`).then(r => r.json()).then(setTasks).catch(() => {});

    return;
  }, []);

  function closeTeamSelectionModal() {
    setEditTaskStaffModalOpen(false);
    setSelectedTeam({});
    setSupervisorId(null);
    setTeamManageCleaners([]);
  }

  // --- TEAM SELECTION MODAL ---
  function TeamSelectionModal() {
    // debugger;

    
    async function handleTeamSelectedModalSave() {
      if (!selectedTeam?.id || !selectedRecurringIds.length) {
        if (window.showToast) {
          window.showToast("Please select recurring patterns and a team.");
        }
        return;
      }

      try {
        setLoading(true);

        await Promise.all(
          selectedRecurringIds.map((rid) =>
            fetch(`${VITE_KEY}api/recurring_setting/${rid}/tasks`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                team_id: selectedTeam.id,
                staff_id: supervisorId,
                task_team_members: teamManageCleaners
              })
            })
          )
        );

        if (window.showToast) {
          window.showToast("Team updated for selected recurring shifts.");
        }

        // Reset modal + selections
        setEditTaskStaffModalOpen(false);
        setSelectedTeam({});
        setSupervisorId(null);
        setTeamManageCleaners([]);
        setSelectedRecurringIds([]);

        // Reload recurring data
        await loadRecurring();
      } catch (e) {
        console.error("Failed to update recurring team", e);
        if (window.showToast) {
          window.showToast("Failed to update team for recurring shifts.");
        }
      } finally {
        setLoading(false);
        setSelectedPatternAction("");
      }
    }


    return (
      <Modal open={editTaskStaffModalOpen} title="Select Team" onClose={closeTeamSelectionModal}>
        <div style={{display:'flex', flexDirection:'column', gap:12, minWidth:340}}>
          <div>
            <strong>Teams</strong>
            <div>
              {(teams).map(team => (
                <label key={team.id} style={{display:'flex',alignItems:'center',gap:6}}>
                  <input type="radio"
                    checked={selectedTeam ? selectedTeam.id === team.id : false}
                    onChange={()=>{
                      setSelectedTeam(team);
                      setSupervisorId(team.supervisor_id);
                      setTeamManageCleaners(
                        teamMembers.filter(arr => {
                          if (arr.team_id == team.id) {
                            return true;
                          }

                          return false;
                        }).map(arr => arr.staff_id)
                      )
                      // setCurrentTask(f=>(
                      //   {
                      //     ...f, 
                      //     staff_id:team.supervisor_id,
                      //   }
                      // ))
                      // setManageCleaners(
                      //   teamMembers.filter(arr => {
                      //     if (arr.team_id == team.id) {
                      //       return true;
                      //     }

                      //     return false;
                      //   }).map(arr => arr.staff_id)
                      // );
                    }}
                  />
                  {team.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <strong>Supervisors</strong>
            <div>
              {staffs.filter(t => t.role === 'Supervisor').map(staff =>
                <label key={staff.id} style={{display:'flex',alignItems:'center',gap:6}}>
                  <input type="radio"
                    checked={staff.id === supervisorId}
                    onChange={()=>setSupervisorId(staff.id)}
                  />
                  {staff.name}
                </label>
              )}
            </div>
          </div>
          <div>
            <strong>Staff</strong>
            <div>
              {staffs.map(s => {
                const isSelected = teamManageCleaners.some(tm => tm === s.id);
                return (
                  <label key={s.id} style={{display:'flex',alignItems:'center',gap:6}}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        if (e.target.checked) {
                          // Add to manageCleaners if not present
                          setTeamManageCleaners(arr => [...new Set([...arr, s.id])]);
                        } else {
                          // Remove from manageCleaners
                          setTeamManageCleaners(arr => arr.filter(id => id !== s.id));
                        }
                      }}
                    />
                    {s.name}
                  </label>
                );
              })}
            </div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className='btn' onClick={closeTeamSelectionModal}>Cancel</button>
            <button className='btn primary' onClick={handleTeamSelectedModalSave}>Select Team</button>
          </div>
        </div>
      </Modal>
    );
  }

  // Manage Staff Modal Opener
  function openManageStaffModal() {
    if (task.staff_id || task.task_team_members?.length > 0) {
      if (task.staff_id) {
        setManageStaffModalSupervisor(task.staff_id);
      }
  
      if (task.task_team_members?.length > 0) {
        setManageStaffModalCleaners(task.task_team_members);
      }
      // useEffect(() => {
      // })
    }

    setManageStaffModalOpen(true);
  }

  function closeManageStaffModal() {
    setManageStaffModalOpen(false);
    setManageStaffModalSupervisor(null);
    setManageStaffModalCleaners([]);
  }

  // --- Staff Selection Modal ---
  function ManageStaffModal() {
    if (!manageStaffModalOpen) {
      return null;
    }

    // if (task.assignment_type) {
    //   setManageTab(task.assignment_type);
    // }
    
    async function onSaveManageStaffModal() {
      if (!selectedRecurringIds.length) {
        if (window.showToast) {
          window.showToast("Please select recurring patterns to update.");
        }
        return;
      }

      try {
        setLoading(true);

        await Promise.all(
          selectedRecurringIds.map((rid) =>
            fetch(`${VITE_KEY}/api/recurring_setting/${rid}/tasks`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                staff_id: manageStaffModalSupervisor,
                task_team_members: manageStaffModalCleaners
              })
            })
          )
        );

        if (window.showToast) {
          window.showToast("Staff updated for selected recurring shifts.");
        }

        // Reset modal state
        setManageStaffModalOpen(false);
        setManageStaffModalSupervisor(null);
        setManageStaffModalCleaners([]);

        // Reload recurring data
        await loadRecurring();
      } catch (e) {
        console.error("Failed to update recurring staff", e);
        if (window.showToast) {
          window.showToast("Failed to update staff for recurring shifts.");
        }
      } finally {
        setLoading(false);
        setSelectedPatternAction("");
      }
    }

    return (
      <Modal open={manageStaffModalOpen} title={"Manage Staff Assignment"} onClose={closeManageStaffModal}>
        <div style={{minWidth:400, padding:10}}>
          {(
            <div>
              <div>
                <strong>Supervisors</strong>
                <div style={{marginBottom:8}}>
                  <select
                    value={manageStaffModalSupervisor || ""}
                    onChange={e=>setManageStaffModalSupervisor(e.target.value)}
                    style={{width:'100%'}}
                  >
                    <option value="">Select Supervisor</option>
                    {staffs.filter(s=>s.role==='Supervisor').map(s=>
                      <option key={s.id} value={s.id}>{s.name}</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <strong>Cleaners</strong>
                <div>
                  {staffs.map(s=>(
                    <label key={s.id} style={{display:'flex',alignItems:'center',gap:6}}>
                      <input
                        type="checkbox"
                        checked={manageStaffModalCleaners.includes(s.id)}
                        onChange={e => {
                          if (e.target.checked) setManageStaffModalCleaners(arr => [...arr, s.id]);
                          else setManageStaffModalCleaners(arr => arr.filter(id => id !== s.id));
                        }}
                      />{s.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
            <button className="btn" onClick={closeManageStaffModal} disabled={loading}>Cancel</button>
            <button className="btn primary" onClick={onSaveManageStaffModal} disabled={loading}>Save</button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- LOCATION SELECTION MODAL ---

  function openLocationSelectionModal() {

    setLocationSearchText('');
    setLocationSearchResults([]);
    setSelectedLocationPlace(null);
    setLocationUnitNo('');
    setlocationComment('');
    setLocationRadiusMeter(100);
    setLocationLoadingDelete({});

    setLocationModalOpen(true);
  }

  function LocationSelectionModal() {
    // Load Google Maps Places API
    useEffect(() => {
      if (!locationMapLoaded) {
        // debugger;
        loadGoogleMapsApi(GOOGLE_MAPS_API_KEY)
          .then(maps => {
            // debugger;
            setLocationMapLoaded(true)
          })
          .catch((err) => {
            debugger;;
            console.error('error while loading map', err);
          });
      }
    }, [locationMapLoaded]);

    // Update map marker/circle when place selected
    useEffect(() => {
      // debugger;
      if (locationMapLoaded && selectedLocationPlace && mapRef.current) {
        const maps = window.google.maps;
        const map = mapRef.current;
        if (markerRef.current) markerRef.current.setMap(null);
        if (circleRef.current) circleRef.current.setMap(null);
        const latlng = {lat: selectedLocationPlace.geometry.location.lat(), lng: selectedLocationPlace.geometry.location.lng()};
        markerRef.current = new maps.Marker({position:latlng, map});
        circleRef.current = new maps.Circle({
          map,
          center: latlng,
          radius: locationRadiusMeter,
          fillColor: '#1976d2',
          fillOpacity: 0.2,
          strokeColor: '#1976d2',
        });
        map.setCenter(latlng);
        map.setZoom(16);
      }
    }, [selectedLocationPlace, locationRadiusMeter, locationMapLoaded]);

    // Initialize map
    useEffect(() => {
      // debugger;
      if (locationMapLoaded && !mapRef.current && locationModalOpen) {
        const maps = window.google.maps;
        mapRef.current = new maps.Map(document.getElementById('location-map'), {
          center: {lat: -33.8688, lng: 151.2195},
          zoom: 13,
        });
      }
    }, [locationMapLoaded]);

    function handleSearch() {
      // debugger;
      if (!locationSearchText || !window.google || !window.google.maps) {
        return;
      }

      if (locationMapLoaded && !mapRef.current && locationModalOpen) {
        const maps = window.google.maps;
        mapRef.current = new maps.Map(document.getElementById('location-map'), {
          center: {lat: -33.8688, lng: 151.2195},
          zoom: 13,
        });
      }
      
      try {
        const service = new window.google.maps.places.PlacesService(mapRef.current);
        service.textSearch({query: locationSearchText}, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            setLocationSearchResults(results);
          } else {
            console.error('Text search failed:', status);
            console.error('Text search failed:', results);
          }
        })
      } catch (err){
        debugger;
        console.error('Text search errored:', err);

      }

      
    }

    function handleSelectPlace(place) {
      setSelectedLocationPlace(place);
      setLocationSearchResults([]);
    }

    async function handleLocationModalAdd(loc) {
      if (!loc?.id || !selectedRecurringIds.length) {
        if (window.showToast) {
          window.showToast("Please select recurring patterns to update location.");
        }
        return;
      }

      try {
        setLoading(true);

        await Promise.all(
          selectedRecurringIds.map((rid) =>
            fetch(`${VITE_KEY}/api/recurring_setting/${rid}/tasks`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location_id: loc.id
              })
            })
          )
        );

        if (window.showToast) {
          window.showToast("Location updated for selected recurring shifts.");
        }

        // Close modal and reset state
        setLocationModalOpen(false);
        setSelectedRecurringIds([]);

        // Reload recurring data
        await loadRecurring();
      } catch (e) {
        console.error("Failed to update recurring location", e);
        if (window.showToast) {
          window.showToast("Failed to update location for recurring shifts.");
        }
      } finally {
        setLoading(false);
        setSelectedPatternAction("");
      }
    }

    function handleAddLocation() {
      const loc = {
        title: selectedLocationPlace?.name || '',
        address: selectedLocationPlace?.formatted_address || '',
        lat: selectedLocationPlace?.geometry.location.lat(),
        lng: selectedLocationPlace?.geometry.location.lng(),
        unit_no: locationUnitNo,
        radius_meters: locationRadiusMeter,
        comment: locationComment,
      };
    
      fetch(`${VITE_KEY}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      })
        .then(r => r.json())
        .then(newLoc => {
          handleLocationModalAdd(newLoc);
          return fetch(`${VITE_KEY}/api/locations`);
        })
        .then(r => r.json())
        .then(setLocations)
        .catch(e => console.error('Add location error', e));
    }

    // --- Recent Locations Table ---
    // Sort by created_at DESC if available, else by array order (most recent first)
    let locationsSorted = [...locations];
    locationsSorted.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      return 0;
    });
    const recentLocations = locationsSorted.slice(0, 10);

    async function handleDeleteLocation(locId) {
      setLocationLoadingDelete(ld => ({...ld, [locId]: true}));
      try {
        await fetch(`${VITE_KEY}/api/locations/${locId}`, { method: 'DELETE' });
        // Refresh locations list
        fetch(`${VITE_KEY}/api/locations`)
          .then(r => r.json())
          .then(setLocations)
          .catch(()=>{});
      } catch (e) {
        // ignore
      }
      setLocationLoadingDelete(ld => ({...ld, [locId]: false}));
    }

    useEffect(() => {
      if (locationModalOpen) {
        fetch(`${VITE_KEY}/api/locations`)
          .then(r => r.json())
          .then(setLocations)
          .catch(e => console.error('Fetch locations error', e));
      }
    }, [locationModalOpen]);

    // if (!locationModalOpen) {
    //   return;
    // }

    return (
      <Modal open={locationModalOpen} title="Select Location" onClose={()=>setLocationModalOpen(false)}>
        <div style={{display:'flex', flexDirection:'column', gap:10, minWidth:400}}>
          <div>
            <input
              type="text"
              placeholder="Search location"
              value={locationSearchText}
              onChange={e => setLocationSearchText(e.target.value)}
              style={{width:'70%'}}
            />
            <button className="btn" onClick={handleSearch} style={{marginLeft:8}}>Search</button>
          </div>
          {locationSearchResults.length > 0 && (
            <div style={{maxHeight:120, overflowY:'auto', border:'1px solid #ddd', marginBottom:8}}>
              {locationSearchResults.map((r, idx) => (
                <div
                  key={idx}
                  style={{padding:6, cursor:'pointer'}}
                  onClick={()=>handleSelectPlace(r)}
                >{r.name} <span style={{fontSize:11, color:'#888'}}>{r.formatted_address}</span></div>
              ))}
            </div>
          )}
          <div style={{display:'flex', gap:8}}>
            <input
              type="text"
              placeholder="Unit No"
              value={locationUnitNo}
              onChange={e=>setLocationUnitNo(e.target.value)}
              style={{width:'30%'}}
            />
            <input
              type="text"
              placeholder="Location Comment"
              value={locationComment}
              onChange={e=>setlocationComment(e.target.value)}
              style={{width:'60%'}}
            />
            <input
              type="number"
              min={10}
              max={1000}
              step={10}
              placeholder="Radius (m)"
              value={locationRadiusMeter}
              onChange={e=>setLocationRadiusMeter(Number(e.target.value))}
              style={{width:'25%'}}
            />
          </div>
          <div id="location-map" style={{width:'100%',height:220,margin:'8px 0',border:'1px solid #bbb'}}></div>
          {/* Recent Locations Table */}
          <div style={{marginTop:16}}>
            <div style={{fontWeight:'bold', fontSize:16, marginBottom:6}}>Recent Locations (Last 10 Used)</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
                <thead>
                  <tr style={{background:'#eee'}}>
                    <th style={{padding:'6px 8px', textAlign:'left'}}>Unit No</th>
                    <th style={{padding:'6px 8px', textAlign:'left'}}>Address</th>
                    <th style={{padding:'6px 8px', textAlign:'left'}}>Radius (m)</th>
                    <th style={{padding:'6px 8px', textAlign:'left'}}>Comment</th>
                    <th style={{padding:'6px 8px', textAlign:'center'}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLocations.map((loc, idx) => (
                    <tr key={loc.id}
                      style={{
                        background: idx % 2 === 0 ? '#f9f9f9' : '#fff'
                      }}
                    >
                      <td style={{padding:'6px 8px'}}>{loc.unit_no || '-'}</td>
                      <td style={{padding:'6px 8px'}}>{(loc.title + '\n' + loc.address) || '-'}</td>
                      <td style={{padding:'6px 8px'}}>{loc.radius_meters || '-'}</td>
                      <td style={{padding:'6px 8px'}}>{loc.comment || '-'}</td>
                      <td style={{padding:'6px 8px', textAlign:'center', minWidth:90}}>
                        <button
                          className="btn"
                          title="Use this location"
                          style={{background:'#16a34a', color:'#fff', padding:'2px 8px', borderRadius:4, marginRight:6, fontSize:18, border:'none', cursor:'pointer'}}
                          onClick={()=>handleLocationModalAdd(loc)}
                        >✅</button>
                        <button
                          className="btn"
                          title="Delete this location"
                          style={{background:'#dc2626', color:'#fff', padding:'2px 8px', borderRadius:4, fontSize:18, border:'none', cursor:'pointer'}}
                          disabled={locationLoadingDelete[loc.id]}
                          onClick={()=>handleDeleteLocation(loc.id)}
                        >❌</button>
                      </td>
                    </tr>
                  ))}
                  {recentLocations.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{padding:'8px', textAlign:'center', color:'#888'}}>No locations found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" onClick={()=>setLocationModalOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={handleAddLocation} disabled={!selectedLocationPlace}>Add Location</button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- Client Update Modal ---
  function openClientModal() {
    setSelectedClientId( task?.client_id || '');
  
    setClientForm({
      task_client_name: task?.task_client_name || '',
      task_client_company: task?.task_client_company || '',
      task_client_email: task?.task_client_email || '',
      task_client_phone: task?.task_client_phone || '',
      task_client_abn: task?.task_client_abn || '',
      task_client_acn: task?.task_client_acn || '',
      task_client_instruction: task?.task_client_instruction || '',
      task_client_information: task?.task_client_information || '',
      task_client_property_information: task?.task_client_property_information || ''
    });
  
    setClientModalOpen(true);
  }

  function handleClientSelect(clientId) {
    setSelectedClientId(clientId);
  
    const client = clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
  
    // Populate task client fields (NOT updating client table)
    setClientForm(f => ({
      ...f,
      task_client_name: client.name || '',
      task_client_company: client.company || '',
      task_client_email: client.email || '',
      task_client_phone: client.phone || '',
      task_client_abn: client.abn || '',
      task_client_acn: client.acn || '',
      task_client_instruction: client.instruction || '',
      task_client_information: client.information || '',
      task_client_property_information: client.property_information || ''
    }));
  }

  function ClientUpdateModal() {
    if (!clientModalOpen) return null;
  
    async function handleSaveClient() {
      if (!selectedRecurringIds.length) {
        window.showToast?.("Please select recurring patterns to update client details.");
        return;
      }
  
      try {
        setLoading(true);
  
        await Promise.all(
          selectedRecurringIds.map((rid) =>
            fetch(`${VITE_KEY}/api/recurring_setting/${rid}/tasks`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...clientForm
              })
            })
          )
        );
  
        window.showToast?.("Client details updated for selected recurring shifts.");
  
        setClientModalOpen(false);
        setSelectedRecurringIds([]);
        await loadRecurring();
      } catch (e) {
        console.error(e);
        window.showToast?.("Failed to update client details.");
      } finally {
        setLoading(false);
        setSelectedPatternAction('');
      }
    }

    
  
    return (
      <Modal
        open={clientModalOpen}
        title="Update Client Details"
        onClose={() => setClientModalOpen(false)}
      >
        
        <div style={{display:'flex', flexDirection:'column', gap:20}}>
          {/* Header Section */}
          <div style={{
            background:'#eef2ff',
            padding:'14px 18px',
            borderRadius:8,
            border:'1px solid #c7d2fe'
          }}>
            <div style={{fontWeight:600, color:'#4338ca', fontSize:16, "textAlign": "start"}}>
              Client Assignment
            </div>
            <div style={{fontSize:13, color:'#6b7280', marginTop:4, "textAlign": "start"}}>
              Choose a client template for this shift
            </div>
            <select
              className="form-input"
              style={{ "alignItems": 'start',float: 'left', "marginTop": '10px',width: '100%'}}
              value={selectedClientId}
              onChange={e => handleClientSelect(e.target.value)}
            >
              <option value="">-- Select client --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>
            

          <div style={{
            display:'grid',
            gridTemplateColumns:'1fr 1fr',
            gap:14
          }}>
            {/* Client Name */}
              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">Client Name
              <input
                className="form-input"
                value={clientForm.task_client_name}
                onChange={e =>
                  setClientForm(f => ({ ...f, task_client_name: e.target.value }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>

            {/* Company */}
              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">Company
              <input
                className="form-input"
                value={clientForm.task_client_company}
                onChange={e =>
                  setClientForm(f => ({ ...f, task_client_company: e.target.value }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>

            {/* Email */}
              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">Email
              <input
                className="form-input"
                type="email"
                value={clientForm.task_client_email}
                onChange={e =>
                  setClientForm(f => ({ ...f, task_client_email: e.target.value }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>

            {/* Phone */}
              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">Phone
              <input
                className="form-input"
                value={clientForm.task_client_phone}
                onChange={e =>
                  setClientForm(f => ({ ...f, task_client_phone: e.target.value }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>

            {/* ABN / ACN */}
              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">ABN
              <input
                className="form-input"
                value={clientForm.task_client_abn}
                onChange={e =>
                  setClientForm(f => ({ ...f, task_client_abn: e.target.value }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>

              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">ACN
              <input
                className="form-input"
                value={clientForm.task_client_acn}
                onChange={e =>
                  setClientForm(f => ({ ...f, task_client_acn: e.target.value }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>
            
          

            {/* Instructions */}
              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">Client Instructions
              <textarea
                className="form-textarea"
                rows={3}
                value={clientForm.task_client_instruction}
                onChange={e =>
                  setClientForm(f => ({ ...f, task_client_instruction: e.target.value }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>

            {/* Client Information */}
              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">Client Information
              <textarea
                className="form-textarea"
                rows={3}
                value={clientForm.task_client_information}
                onChange={e =>
                  setClientForm(f => ({ ...f, task_client_information: e.target.value }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>

            {/* Property Information */}
              <label style={{alignItems:'start', display:'flex', flexDirection:'column'}} className="form-label">Property Information
              <textarea
                className="form-textarea"
                rows={3}
                value={clientForm.task_client_property_information}
                onChange={e =>
                  setClientForm(f => ({
                    ...f,
                    task_client_property_information: e.target.value
                  }))
                }
                style={{marginTop:6, width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
              />
              </label>

          </div>
          {/* Actions */}
          <div style={{display:'flex', justifyContent:'flex-end', gap:10}}>
            <button className="btn" onClick={() => setClientModalOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleSaveClient}>
              Save
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Time Length Modal Update
  function TimeLengthModal() {
    if (!timeLengthModalOpen) return null;
  
    debugger;
    return (
      <Modal
        open={timeLengthModalOpen}
        title={"Update Task Time (Time Only)"}
        onClose={() => setTimeLengthModalOpen(false)}
      >
        <div style={{ minWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <strong>Start Time</strong>
            <input
              type="time"
              value={newStartTime}
              onChange={e => setNewStartTime(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
  
          <label>
            <strong>End Time</strong>
            <input
              type="time"
              value={newEndTime}
              onChange={e => setNewEndTime(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
  
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setTimeLengthModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!newStartTime || !newEndTime}
              onClick={handleSaveTimeLengthUpdate}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  async function handleSaveTimeLengthUpdate() {
    try {
      setLoading(true);

      debugger;
  
      await Promise.all(
        selectedRecurringIds.map(rid =>
          fetch(`${VITE_KEY}/api/recurring_setting/${rid}/tasks`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              new_start_time: newStartTime,
              new_end_time: newEndTime
            })
          })
        )
      );
  
      window.showToast?.(
        "Task time updated successfully"
      );
  
      setTimeLengthModalOpen(false);
      setSelectedRecurringIds([]);
      setSelectedPatternAction("");
      await loadRecurring();
    } catch (e) {
      console.error(e);
      window.showToast?.("Failed to update recurring tasks");
    } finally {
      setLoading(false);
    }
  }


  
  async function loadRecurring() {
    debugger;
    if (!task?.id) return;
    try {
      const res = await fetch(`${VITE_KEY}/api/recurring/${task.id}`);
      const data = await res.json();

      // Set recurring settings state if array
      if (Array.isArray(data.row)) {
        setRecurringSettings(data.row);
      }

      // Remove selecting frequency/days from first recurring; instead, reset form inputs
      setFrequency(1);
      setSelectedDays([]);
      setOccurrences("");
      setCloseDate("");

      if (Array.isArray(data.children)) {
        setChildTasks(
          data.children.map(c => ({
            id: c.id,
            start_time: c.start_time,
            end_time: c.end_time,
            team_id: c.team_id,
            staff_id: c.staff_id,
            client_id: c.client_id,
            location_id: c.location_id
          }))
        );
      } else {
        setChildTasks([]);
      }
    } catch (e) {
      console.error('load recurring error', e);
      if (window.showToast) {
        window.showToast('load recurring error', e);
      }
    }
  }
  
  useEffect(() => {
    loadRecurring();
  }, [task]);

  const resetForm = () => {
    setFrequency(1);
    setSelectedDays([]);
    setOccurrences("");
    setCloseDate("");
  };

  const createRecurringShifts = async () => {
    if (selectedDays.length === 0) {
      alert("Select at least one day");
      return;
    }

    if (!occurrences && !closeDate) {
      alert("Provide occurrences or close date");
      return;
    }

    setLoading(true);

    debugger;

    await fetch(`${VITE_KEY}/api/tasks/${task.id}/recurring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frequency,
        selectedDays,
        occurrences: occurrences || null,
        closeDate: closeDate || null,
        startingDate: task.start_date || task.start_time,
        team_id: task.team_id,
        parent_task: task.id
      })
    });

    setLoading(false);
    alert("Recurring shifts created");
  };

  const openEditChildTask = (t) => {
    setEditTaskData({ ...t });
    setEditModalOpen(true);
  };

  const saveChildTask = async () => {
    if (!editTaskData || !editTaskData.id) return;
    try {
      const payload = {
        task_name: editTaskData.task_name || task.task_name,
        team_id: editTaskData.team_id || null,
        staff_id: editTaskData.staff_id || null,
        client_id: editTaskData.client_id || null,
        location_id: editTaskData.location_id || null,
        start_time: editTaskData.start_time,
        end_time: editTaskData.end_time
      };
      const res = await fetch(`${VITE_KEY}/api/tasks/${editTaskData.id}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const updated = await res.json();

      setChildTasks(cs => cs.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      setEditModalOpen(false);
      setEditTaskStaffModalOpen(false);
      setEditTaskData(null);
    } catch (e) { console.error('save child task', e); alert('Could not save task'); }
  };

  return (
    <div className="recurring-box">
      <h3>Recurring Shift Settings</h3>

      {/* REPEAT FREQUENCY */}
      <label>Repeat Frequency</label>
      <select
        value={frequency}
        onChange={(e) => setFrequency(Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5].map((w) => (
          <option key={w} value={w}>
            Every {w} week{w > 1 ? "s" : ""}
          </option>
        ))}
      </select>

      {/* SELECT DAYS */}
      <section className="days-section">
        <label>Select Days</label>
        <div className="days-grid">
          {DAYS.map((d, i) => (
            <button
              key={i}
              className={selectedDays.includes(d.value) ? "day selected" : "day"}
              onClick={() => toggleDay(d.value)}
            >
              {d.key}
            </button>
          ))}
        </div>
      </section>

      {/* OCCURRENCES */}
      <label>Occurrences</label>
      <input
        type="number"
        placeholder="e.g. 10"
        value={occurrences}
        disabled={closeDate}
        style={{width:'100%'}}
        onChange={(e) => setOccurrences(e.target.value)}
      />

      {/* CLOSE DATE */}
      <label>Close Date</label>
      <input
        type="date"
        value={closeDate}
        disabled={occurrences}
        style={{width:'100%'}}
        onChange={(e) => setCloseDate(e.target.value)}
      />

      {/* Recurring patterns (generated shifts) */}
    {recurringSettings.length > 0 && (
      <div style={{marginTop:12, padding:12, border:'1px solid #eef2f6', borderRadius:8, background:'#fff'}}>
        <div style={{fontWeight:700, marginBottom:8}}>Existing Recurring Patterns</div>

        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#f3f4f6'}}>
              <th style={{padding:8, border:'1px solid #e5e7eb'}}>Select</th>
              <th style={{padding:8, border:'1px solid #e5e7eb'}}>Day</th>
              <th style={{padding:8, border:'1px solid #e5e7eb'}}>Every (Weeks)</th>
              <th style={{padding:8, border:'1px solid #e5e7eb'}}>Task Length (min)</th>
              <th style={{padding:8, border:'1px solid #e5e7eb'}}>Details</th>
              <th style={{padding:8, border:'1px solid #e5e7eb'}}>Close Date</th>
            </tr>
          </thead>
          <tbody>
            {recurringSettings.map((c) => {
              const day =
                c.monday ? "Monday" :
                c.tuesday ? "Tuesday" :
                c.wednesday ? "Wednesday" :
                c.thrusday ? "Thursday" :
                c.friday ? "Friday" :
                c.saturday ? "Saturday" :
                c.sunday ? "Sunday" : "";

              const validClose = c.close_date ? dayjs(c.close_date).isValid() ? dayjs(c.close_date).format("D MMM YYYY") : "" : "";

              return (
                <tr key={c.id}>
                  <td style={{padding:8, border:'1px solid #e5e7eb', textAlign:'center'}}>
                    <input
                      type="checkbox"
                      checked={selectedRecurringIds.includes(c.id)}
                      onChange={() => {
                        setSelectedRecurringIds(prev =>
                          prev.includes(c.id)
                            ? prev.filter(id => id !== c.id)
                            : [...prev, c.id]
                        );
                      }}
                    />
                  </td>
                  <td style={{padding:8, border:'1px solid #e5e7eb'}}>{day}</td>
                  <td style={{padding:8, border:'1px solid #e5e7eb'}}>{c.request_freq}</td>
                  <td style={{padding:8, border:'1px solid #e5e7eb'}}>{c.task_length || ""}</td>
                  <td style={{padding:8, border:'1px solid #e5e7eb'}}>{c.details || ""}</td>
                  <td style={{padding:8, border:'1px solid #e5e7eb'}}>{validClose}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Dropdown for recurring pattern actions */}
        {recurringSettings.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 600, marginRight: 8 }}>Change Type:</label>
            <select
              value={selectedPatternAction || ""}
              onChange={async (e) => {
                if (selectedRecurringIds.length === 0) {
                  if (window.showToast) {
                    window.showToast("Please select at least one recurring shift.");
                  } else {
                    alert("Please select at least one recurring shift.");
                  }
                  return;
                }
                // Modified handler for "drop"
                const action = e.target.value;

                setSelectedPatternAction(action);

                if (action === "drop") {
                  setLoading(true);

                  Promise.all(
                    selectedRecurringIds.map((rid) =>
                      fetch(`${VITE_KEY}/api/recurring_setting/${rid}`, {
                        method: "DELETE"
                      })
                    )
                  )
                    .then(async (resps) => {
                      if (!resps || resps.length === 0) {
                        throw 'Failed to fetch delete response';
                      }

                      let failedRespBody = [];
                      for (let resp of resps) {
                        let respJson = await resp.json();
                        if (!resp.ok) {
                          failedRespBody.push(respJson);
                        } else {
                          console.log('Recurring setting deleted', respJson);
                        }
                      }

                      if (window.showToast) {
                        window.showToast("Recurring pattern deleted successfully.");
                      }
                      // Reload list
                      await loadRecurring();
                      setSelectedRecurringIds([]);
                    })
                    .catch((err) => {
                      debugger;
                      if (window.showToast) {
                        window.showToast("Failed to delete recurring shift.");
                      }
                    })
                    .finally(() => {
                      setLoading(false);
                      setSelectedPatternAction("");
                    });
                } else if (action === "team_staff") {

                  if (task.assignment_type === 'team' && task.team_id) {
                    teams.every(team => {
                      if (task.team_id === team.id) {
                        setSelectedTeam({ ...team, supervisor_id: task.staff_id });
                        setSupervisorId(task.staff_id);
                        setTeamManageCleaners(task.task_team_members);
                        return false;
                      }
              
                      return true;
                    });
                    // useEffect(() => {
                    // })
              
                  }
                  setEditTaskStaffModalOpen(true);

                } else if (action === "location") {
                  openLocationSelectionModal();
                } else if (action === "individual_staff") {
                  openManageStaffModal();
                } else if (action === 'client') {
                  openClientModal();
                } else if (action === 'time') {
                  setNewStartTime(task?.start_time ? dayjs(task.start_time).format('HH:mm') : '');
                  setNewEndTime(task?.end_time ? dayjs(task.end_time).format('HH:mm') : '');
                  setTimeLengthModalOpen(true);
                }
              }}

              style={{
                padding: "8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                minWidth: 200,
                width:'100%',
              }}
            >
              <option value="">Select For Change</option>
              <option value="drop">Drop</option>
              <option value="team_staff">Team Staff</option>
              <option value="individual_staff">Individual Staff</option>
              <option value="client">Client</option>
              <option value="time">Time</option>
              <option value="location">Location</option>
            </select>
          </div>
        )}
        {/* Loader display for drop action */}
        {loading && (
          <div style={{ marginTop: 10, fontWeight: 600, color: "#2563eb" }}>
            Processing...
          </div>
        )}
      </div>
    )}

      {/* Existing Recurring Patterns */}
      {/* {recurringSettings.length > 0 && (
        <div style={{marginBottom:12}}>
          <label style={{fontWeight:600}}>Existing Recurring Patterns</label>
          {recurringSettings.map(rs => (
            <div key={rs.id} style={{display:'flex', alignItems:'center', gap:8}}>
              <input
                type="checkbox"
                checked={selectedRecurringIds.includes(rs.id)}
                onChange={() => {
                  setSelectedRecurringIds(prev =>
                    prev.includes(rs.id)
                      ? prev.filter(id => id !== rs.id)
                      : [...prev, rs.id]
                  );
                }}
              />
              <span>
                {Object.entries({
                  Mon: rs.monday,
                  Tue: rs.tuesday,
                  Wed: rs.wednesday,
                  Thu: rs.thrusday,
                  Fri: rs.friday,
                  Sat: rs.saturday,
                  Sun: rs.sunday
                }).filter(([k,v]) => v).map(([k]) => k).join(", ")}
                — Every {rs.request_freq} week(s)
              </span>
            </div>
          ))}
        </div>
      )} */}

      <br />

      <button style={{background: '#6366f1', color: '#ffffff'}} onClick={createRecurringShifts} disabled={loading}>
        {loading ? "Creating..." : "Create Recurring Shifts"}
      </button>
      <button onClick={resetForm}>Reset Form</button>

      {editModalOpen && editTaskData && (
        <div className="modal-backdrop">
          <div className="modal" style={{width:520}}>
            <div className="modal-header">
              <div style={{fontWeight:700}}>Edit Generated Shift</div>
              <button className="close-btn" onClick={()=>{ setEditModalOpen(false); setEditTaskStaffModalOpen(false); setEditTaskData(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <label>Team ID
                <input value={editTaskData.team_id || ''} onChange={e=>setEditTaskData(d=>({...d, team_id: e.target.value}))} />
              </label>
              <label>Staff ID
                <input value={editTaskData.staff_id || ''} onChange={e=>setEditTaskData(d=>({...d, staff_id: e.target.value}))} />
              </label>
              <label>Client ID
                <input value={editTaskData.client_id || ''} onChange={e=>setEditTaskData(d=>({...d, client_id: e.target.value}))} />
              </label>
              <label>Location ID
                <input value={editTaskData.location_id || ''} onChange={e=>setEditTaskData(d=>({...d, location_id: e.target.value}))} />
              </label>
              <label>Start
                <input type="datetime-local" value={editTaskData.start_time ? dayjs(editTaskData.start_time).format('YYYY-MM-DDTHH:mm') : ''} onChange={e=>setEditTaskData(d=>({...d, start_time: e.target.value ? dayjs(e.target.value).toISOString() : ''}))} />
              </label>
              <label>End
                <input type="datetime-local" value={editTaskData.end_time ? dayjs(editTaskData.end_time).format('YYYY-MM-DDTHH:mm') : ''} onChange={e=>setEditTaskData(d=>({...d, end_time: e.target.value ? dayjs(e.target.value).toISOString() : ''}))} />
              </label>
            </div>
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, padding:12}}>
              <button className="btn" onClick={()=>{ setEditModalOpen(false); setEditTaskStaffModalOpen(false); setEditTaskData(null); }}>Cancel</button>
              <button className="btn primary" onClick={saveChildTask}>Save</button>
            </div>
          </div>
        </div>
      )}

    {TeamSelectionModal()}
    {ManageStaffModal()}
    {LocationSelectionModal()}
    {TimeLengthModal()}
    <ClientUpdateModal />
    </div>
  );
}