import React, { useState, useEffect } from "react";
import dayjs from "dayjs";

const DAYS = [
  { key: "M", value: 1 },
  { key: "T", value: 2 },
  { key: "W", value: 3 },
  { key: "Th", value: 4 },
  { key: "F", value: 5 },
  { key: "Sa", value: 6 },
  { key: "Su", value: 0 }
];

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

  // Inline edit modal state for child tasks (kept in state if needed later)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState(null);

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
  
  useEffect(() => {
    async function loadRecurring() {
      debugger;
      if (!task?.id) return;
      try {
        const res = await fetch(`http://localhost:4000/api/recurring/${task.id}`);
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
      }
    }
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

    await fetch(`http://localhost:4000/api/tasks/${task.id}/recurring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frequency,
        selectedDays,
        occurrences: occurrences || null,
        closeDate: closeDate || null,
        startingDate: task.start_date,
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
      const res = await fetch(`http://localhost:4000/api/tasks/${editTaskData.id}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const updated = await res.json();

      setChildTasks(cs => cs.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      setEditModalOpen(false);
      setEditTaskData(null);
    } catch (e) { console.error('save child task', e); alert('Could not save task'); }
  };

  return (
    <div className="recurring-box">
      <h3>Recurring Shift Settings</h3>

      {/* Existing Recurring Patterns */}
      {recurringSettings.length > 0 && (
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
      )}

      {/* REPEAT FREQUENCY */}
      <label>Repeat Frequency</label>
      <select
        value={frequency}
        onChange={(e) => setFrequency(Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5].map((w) => (
          <option key={w} value={w+1}>
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
        onChange={(e) => setOccurrences(e.target.value)}
      />

      {/* CLOSE DATE */}
      <label>Close Date</label>
      <input
        type="date"
        value={closeDate}
        disabled={occurrences}
        onChange={(e) => setCloseDate(e.target.value)}
      />

      <br />

      <button style={{background: '#6366f1', color: '#ffffff'}} onClick={createRecurringShifts} disabled={loading}>
        {loading ? "Creating..." : "Create Recurring Shifts"}
      </button>
      <button onClick={resetForm}>Reset Form</button>
    </div>
  );
}