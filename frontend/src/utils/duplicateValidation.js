function sameRecordId(record, currentId) {
  if (currentId === null || currentId === undefined || currentId === '') return false;
  return String(record?.id) === String(currentId);
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function findDuplicateStaffByEmail(staff, email, currentId = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  return staff.find(member => (
    !sameRecordId(member, currentId) &&
    normalizeEmail(member.email) === normalizedEmail
  )) || null;
}

export function findDuplicateTeamByName(teams, name, currentId = null) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;

  return teams.find(team => (
    !sameRecordId(team, currentId) &&
    normalizeText(team.name) === normalizedName
  )) || null;
}

export function findDuplicateClientByEmail(clients, email, currentId = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  return clients.find(client => (
    !sameRecordId(client, currentId) &&
    normalizeEmail(client.email) === normalizedEmail
  )) || null;
}

export function findDuplicateClientByPhone(clients, phone, currentId = null) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  return clients.find(client => (
    !sameRecordId(client, currentId) &&
    normalizePhone(client.phone) === normalizedPhone
  )) || null;
}
