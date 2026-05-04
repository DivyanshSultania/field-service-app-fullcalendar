import { Hono } from 'hono'
import { cors } from 'hono/cors'

import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

import { jwtVerify } from 'jose'
import { generateRecurringDates, normalizeRecurringWeekdays } from './recurring.js';
import {
	buildUtcRangeFromLocalDates,
	combineLocalDateAndTimeToUtcIso,
	compareLocalDays,
	dayjs,
	formatInTimezone,
	getCurrentWeekUtcRange,
	getUtcEndOfLocalDay,
	getUtcEndOfPreviousLocalDay,
	getUtcStartOfLocalDay,
	getRequestTimezone,
	toZonedDateTime
} from './timezone.js';

const uuidv4 = () => crypto.randomUUID();
const homemaidLogo = 'https://pub-ac8edfc52ef04beba837f1804a4abf42.r2.dev/public/homemaid_logo.png';

// const app = express();
const app = new Hono()

app.use('*', cors())

const generateToken = async (payload, secret, jwtTokenExpiry) => {
	const encoder = new TextEncoder()
	const key = encoder.encode(secret)
  
	return await new SignJWT(payload)
	  .setProtectedHeader({ alg: 'HS256' })
	  .setIssuedAt()
	  .setExpirationTime(jwtTokenExpiry)
	  .sign(key)
}

const authMiddleware = async (c, next) => {
	const authHeader = c.req.header('Authorization')
	// TODO: remove in prod
	await next();
	return;
	// TODO Ends

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
	  return c.json({ error: 'Unauthorized' }, 401)
	}
  
	const token = authHeader.split(' ')[1]
  
	try {
	  const encoder = new TextEncoder()
	  const key = encoder.encode(c.env.JWT_SECRET)
  
	  const { payload } = await jwtVerify(token, key)
  
	  c.set('user', payload)
  
	  await next()
	} catch (err) {
	  return c.json({ error: 'Invalid or expired token' }, 401)
	}
  }

/**
 * Helpers for D1
 */
const normalizeParams = (params = []) =>
	params.map(v => v === undefined ? null : v);

const allSql = (db, sql, params = []) =>
	db.prepare(sql).bind(...normalizeParams(params)).all()

const getSql = (db, sql, params = []) =>
	db.prepare(sql).bind(...normalizeParams(params)).first()

const runSql = (db, sql, params = []) =>
	db.prepare(sql).bind(...normalizeParams(params)).run()

/**
 * Minutes between two ISO/datetime strings; null if invalid or negative.
 */
const diffMinutes = (start, end) => {
	if (!start || !end) return null
	const m = dayjs(end).diff(dayjs(start), 'minute')
	if (!Number.isFinite(m) || m < 0) return null
	return Math.floor(m)
}

const diffClockMinutes = (startTimeText, endTimeText) => {
	if (!startTimeText || !endTimeText) return null

	const [startHour, startMinute] = String(startTimeText).split(':').map(Number)
	const [endHour, endMinute] = String(endTimeText).split(':').map(Number)

	if (
		![startHour, startMinute, endHour, endMinute].every(Number.isFinite)
	) {
		return null
	}

	const startTotal = startHour * 60 + startMinute
	const endTotal = endHour * 60 + endMinute
	const diff = endTotal - startTotal

	return diff < 0 ? diff + 24 * 60 : diff
}

/**
 * Pay minutes: min(scheduled, log) when both exist; otherwise whichever side exists.
 */
const computePayLengthMinutes = ({ start_time, end_time, started_at, stopped_at }) => {
	const scheduled = diffMinutes(start_time, end_time)
	const logged = diffMinutes(started_at, stopped_at)
	if (scheduled != null && logged != null) return Math.min(scheduled, logged)
	if (scheduled != null) return scheduled
	if (logged != null) return logged
	return null
}

/* -----------------------------
   🧪 Health
----------------------------- */
app.get('/', c => c.json({ ok: true }))


// app.get('/api/init-db', authMiddleware, async c => {
// 	try {
// 		await runSql(c.env.DB, initSql)
// 		// c.env.DB.exec(initSql)
// 		return c.json({ ok: true })
// 	} catch (err) {
// 		console.error('Init DB error', err);
// 		return c.json({ error: err.message }, 500);
// 	}
// });

/* -----------------------------
   Authentication Login
----------------------------- */
app.post('/api/auth/login', async (c) => {
	try {
	  const { email, password } = await c.req.json()
  
	  if (!email || !password) {
		return c.json({ error: 'Email and password required' }, 400)
	  }

	//   console.log('email: ', email);
	//   console.log('password: ', password);

	  // Find user
	  const user = await getSql(
		c.env.DB,
		'SELECT * FROM staff WHERE email=?',
		[email]
	  )

	//   console.log('user: ', user);

  
	  if (!user) {
		return c.json({ error: 'Invalid credentials' }, 401)
	  }
  
	  // Compare password
	  const isValid = await bcrypt.compare(password, user.password_hash || '')
  
	  if (!isValid) {
		return c.json({ error: 'Invalid credentials' }, 401)
	  }

  
	  // Generate JWT
	  const token = await generateToken(
		{
		  id: user.id,
		  name: user.name,
		  role: user.role
		},
		c.env.JWT_SECRET, // Being sourced from remote, stored in remote using `wrangler secret put JWT_SECRET`
		c.env.TOKEN_EXPIRY
	  )
  
	  return c.json({
		ok: true,
		token,
		user: {
		  id: user.id,
		  name: user.name,
		  email: user.email,
		  role: user.role
		}
	  })
  
	} catch (err) {
	  return c.json({ error: err.message }, 500)
	}
  })

/* -----------------------------
   Webapp (Admin) Login
----------------------------- */
app.post('/api/auth/webapp-login', async (c) => {
	try {
	  const { email, password } = await c.req.json()

	  if (!email || !password) {
		return c.json({ error: 'Email and password required' }, 400)
	  }

	  const admin = await getSql(
		c.env.DB,
		'SELECT * FROM admin WHERE email=?',
		[email]
	  )

	  if (!admin) {
		return c.json({ error: 'Invalid credentials' }, 401)
	  }

	  const isValid = await bcrypt.compare(password, admin.password_hash || '')

	  if (!isValid) {
		return c.json({ error: 'Invalid credentials' }, 401)
	  }

	  const token = await generateToken(
		{
		  id: admin.id,
		  name: admin.name,
		  type: 'admin'
		},
		c.env.JWT_SECRET,
		c.env.TOKEN_EXPIRY
	  )

	  return c.json({
		ok: true,
		token,
		user: {
		  id: admin.id,
		  name: admin.name,
		  email: admin.email,
		  type: 'admin'
		}
	  })
	} catch (err) {
	  return c.json({ error: err.message }, 500)
	}
})

/* -----------------------------
   🖼️ Image Upload (R2)
----------------------------- */
app.post('/api/imageupload/:task_id/:staff_id/:staff_name', authMiddleware,  async c => {
	try {
		const { task_id, staff_id, staff_name } = c.req.param()
		const body = await c.req.parseBody()
	  
		const file = body.image
		if (!file) {
		  return c.json({ error: 'No image uploaded' }, 400)
		}
	  
		const imageId = uuidv4()
		const key = `tasks/${task_id}/${imageId}`
	  
		await c.env.IMAGES_BUCKET.put(key, file, {
		  httpMetadata: { contentType: file.type }
		})
	  
		// const publicUrl = `${c.env.R2_PUBLIC_URL}/${key}`
		const publicUrl = `/${key}`;
	  
		await runSql(
		  c.env.DB,
		  `INSERT INTO images (id, task_id, staff_id, staff_name, images, created_at)
		   VALUES (?, ?, ?, ?, ?, ?)`,
		  [imageId, task_id, staff_id, staff_name, publicUrl, new Date().toISOString()]
		)
	  
		return c.json({
		  ok: true,
		  id: imageId,
		  url: publicUrl
		})
	} catch (err) {
		console.error('Image upload error', err);
		return c.json({ error: err.message }, 500);
	}
})

app.get('/images/*', authMiddleware, async c => {
	const key = c.req.path.replace('/images/', '')
	const object = await c.env.IMAGES_BUCKET.get(key)
  
	if (!object) return c.text('Not Found', 404)
  
	const headers = new Headers()
	object.writeHttpMetadata(headers)
	headers.set('Cache-Control', 'public, max-age=31536000')
  
	return new Response(object.body, { headers })
  })
  
/* -----------------------------
	🖼️ Images
----------------------------- */
app.get('/api/images/:task_id', authMiddleware, async c => {
	try {
		const { task_id } = c.req.param()
		let rows = await allSql(
			c.env.DB,
			'SELECT * FROM images WHERE task_id = ?',
			[task_id]
		)
		rows = rows.results || [];

		return c.json(rows)
	} catch (err) {
		console.error('Get Images error', err);
		return c.json({ error: err.message }, 500);
	}
})

app.post('/api/images', authMiddleware, async c => {
	try {
	  const body = await c.req.json()
	  const { taskIds } = body
  
	  if (!Array.isArray(taskIds) || taskIds.length === 0) {
		return c.json({ error: 'Task Id is required' }, 400)
	  }
  
	  // Build dynamic placeholders for IN clause
	  const placeholders = taskIds.map(() => '?').join(',')
  
	  const { results } = await c.env.DB
		.prepare(`SELECT * FROM images WHERE task_id IN (${placeholders})`)
		.bind(...taskIds)
		.all()
  
	  return c.json(results)
	} catch (e) {
	  return c.json({ error: e.message }, 500)
	}
})

// Simple helpers
// function runSql(sql, params = []) {
// 	return new Promise((resolve, reject) => {
// 		db.run(sql, params, function (err) {
// 			if (err) reject(err);
// 			else resolve(this);
// 		});
// 	});
// }
// function allSql(sql, params = []) {
// 	return new Promise((resolve, reject) => {
// 		db.all(sql, params, (err, rows) => {
// 			if (err) reject(err);
// 			else resolve(rows);
// 		});
// 	});
// }
// function getSql(sql, params = []) {
// 	return new Promise((resolve, reject) => {
// 		db.get(sql, params, (err, row) => {
// 			if (err) reject(err);
// 			else resolve(row);
// 		});
// 	});
// }

// Seed endpoint (for ease)
app.get('/api/seed', authMiddleware, async c => {
	try {
		// --- Staff ---
		const staff = [
			{ name: 'Manish Kumar', email: 'manish@example.com', phone: '+919876543210', role: 'cleaner', color: '#7C3AED' },
			{ name: 'Roxy', email: 'roxy@example.com', phone: '+919234567890', role: 'cleaner', color: '#10B981' },
			{ name: 'Rio', email: 'rio@example.com', phone: '+918888888888', role: 'Supervisor', color: '#059669' },
			{ name: 'Pratik', email: 'pratik@example.com', phone: '+917777777777', role: 'Supervisor', color: '#06B6D4' },
			{ name: 'Test', email: 'test@example.com', phone: '+9177777788777', role: 'Supervisor', color: '#06B6D2' },
		];
		const staffIds = [];
		for (const s of staff) {
			const id = uuidv4();
			staffIds.push(id);
			await runSql(
				c.env.DB,
				'INSERT OR IGNORE INTO staff (id, name, email, phone, role, color) VALUES (?, ?, ?, ?, ?, ?)',
				[id, s.name, s.email, s.phone, s.role, s.color]
			);
		}

		// --- Teams ---
		const teamId = uuidv4();
		await runSql(
			c.env.DB,
			'INSERT OR IGNORE INTO teams (id, name, description, status, supervisor_id) VALUES (?, ?, ?, ?, ?)',
			[teamId, 'Morning Team', 'Handles morning shifts', 'active', staffIds[2]]
		);

		// --- Team Members ---
		for (const sid of [staffIds[0], staffIds[1]]) {
			await runSql(
				c.env.DB,
				'INSERT OR IGNORE INTO team_members (id, team_id, staff_id) VALUES (?, ?, ?)',
				[uuidv4(), teamId, sid]
			);
		}

		// --- Clients ---
		const clientId = uuidv4();
		await runSql(
			c.env.DB,
			`INSERT OR IGNORE INTO clients
       (id, client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				clientId,
				'ACME Corp',
				'ACME Pvt Ltd',
				'client@acme.com',
				'+911234567890',
				'12345678901',
				'987654321',
				'Please ensure floors are cleaned before 9 AM.',
				'Main client in Delhi NCR region.',
				'Office building with 3 floors and 2 restrooms.'
			]
		);

		// --- Locations ---
		const locationId = uuidv4();
		await runSql(
			c.env.DB,
			`INSERT OR IGNORE INTO locations
       (id, title, address, lat, lng, unit_no, radius_meters, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				locationId,
				'ACME HQ',
				'123 Main Street, Delhi',
				28.6139,
				77.2090,
				'Unit 5A',
				100,
				'Main work site'
			]
		);

		// --- Tasks ---
		const appTimezone = getRequestTimezone(c.req, c.env);
		const localNow = dayjs().tz(appTimezone);
		const startTime = localNow.hour(7).minute(30).second(0).millisecond(0).utc().toISOString();
		const endTime = localNow.hour(9).minute(30).second(0).millisecond(0).utc().toISOString();
		const taskId = uuidv4();
		await runSql(
			c.env.DB,
			`INSERT OR IGNORE INTO tasks
        (id, task_name, assignment_type, staff_id, team_id, client_id, location_id,
         start_time, end_time, publish, shift_instructions, color,
         isLocation,
         started_at, stopped_at, travel_from, travel_dist, travel_duration,
         payment_type, payment_amount, payment_date,
         task_client_name, task_client_company, task_client_email, task_client_phone,
         task_client_abn, task_client_acn, task_client_instruction, task_client_information, task_client_property_information)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				taskId,
				'Morning Cleaning',
				'team',
				staffIds[0],
				teamId,
				clientId,
				locationId,
				startTime,
				endTime,
				1,
				'Ensure lobby and restroom are clean.',
				'#7C3AED',
				0,
				null,
				null,
				locationId,
				1.2,
				15.5,
				'hourly',
				'300',
				now.toISOString(),
				'ACME Corp',
				'ACME Pvt Ltd',
				'client@acme.com',
				'+911234567890',
				'12345678901',
				'987654321',
				'Please ensure floors are cleaned before 9 AM.',
				'Main client in Delhi NCR region.',
				'Office building with 3 floors and 2 restrooms.'
			]
		);

		// --- Task Team Members ---
		for (const sid of [staffIds[0], staffIds[1]]) {
			await runSql(
				c.env.DB,
				'INSERT OR IGNORE INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?, ?, ?, ?)',
				[uuidv4(), teamId, taskId, sid]);
		}

		// --- Task Comments ---
		await runSql(
			c.env.DB,
			`INSERT OR IGNORE INTO task_comments (id, task_id, comment, is_read, staff_id)
       VALUES (?, ?, ?, ?, ?)`,
			[uuidv4(), taskId, 'All done, looks great!', 0, staffIds[0]]
		);

		// --- Images ---
		await runSql(
			c.env.DB,
			`INSERT OR IGNORE INTO images (id, task_id, staff_id, images)
       VALUES (?, ?, ?, ?)`,
			[uuidv4(), taskId, staffIds[0], 'https://dummyimage.com/600x400/000/fff&text=After+Cleaning']
		);

		// --- Task Instructions ---
		await runSql(
			c.env.DB,
			`INSERT OR IGNORE INTO task_instructions
       (id, task_id, ques, resp_type, reply, replied_at, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[uuidv4(), taskId, 'Was the mop replaced?', 'yes_no', 'Yes', now.toISOString(), 0]
		);

		return c.json({ ok: true, message: 'Seeded all data successfully.' });
	} catch (e) {
		console.error(e);
		return c.json({ error: e.message }, 500);
	}
});

/* -----------------------------
👥 Staff CRUD
----------------------------- */
app.get('/api/staff', authMiddleware, async context => {
	try {
		let rows = await allSql(
			context.env.DB,	
			'SELECT * FROM staff'
		);

		rows = rows.results || [];

		return context.json(rows);
	} catch (e) { 
		return context.json({ error: e.message }, 500); 
	}
});

app.get('/api/staff/:id', authMiddleware, async context => {
	try {
		let rows = await getSql(
			context.env.DB,
			'SELECT * FROM staff WHERE id=?', 
			[context.req.param().id]
		);
		

		return context.json(rows);
	} catch (e) { 
		return context.json({ error: e.message }, 500); 
	}
});

app.post('/api/staff', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const rosterToken1 = uuidv4();
		const rosterToken2 = uuidv4();

		const body = await context.req.json();
		const { name, email, phone, role, color, password_hash } = body;

		const hashedPassword = password_hash
			? await bcrypt.hash(password_hash, 10)
			: null

		await runSql(
			context.env.DB,
			'INSERT INTO staff (id, name, email, phone, role, color, password_hash, roster_token1, roster_token2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			[id, name, email, phone, role, color, hashedPassword || null, rosterToken1, rosterToken2]
		);
		let row = await getSql(context.env.DB, 'SELECT * FROM staff WHERE id=?', [id]);
		

		return context.json(row);
	} catch (e) { 
		return context.json({ error: e.message }, 500); 
	}
});

app.put('/api/staff/:id', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const { name, email, phone, role, color, password_hash } = body;
		const hashedPassword = password_hash
			? await bcrypt.hash(password_hash, 10)
			: null

		const rosterToken1 = uuidv4();
		const rosterToken2 = uuidv4();

		await runSql(
			context.env.DB,
			'UPDATE staff SET name=?, email=?, phone=?, role=?, color=?, password_hash=?, roster_token1=?, roster_token2=? WHERE id=?',
			[name, email, phone, role, color, hashedPassword, rosterToken1, rosterToken2, context.req.param().id]
		);
		let row = await getSql(context.env.DB, 'SELECT * FROM staff WHERE id=?', [context.req.param().id]);
		

		return context.json(row);
	} catch (e) { 
		return context.json({ error: e.message }, 500); 
	}
});

app.delete('/api/staff/:id', authMiddleware, async context => {
	try {
		const staffId = context.req.param().id;

		// Prevent deletion of static Cover staff
		let staff = await getSql(context.env.DB, 'SELECT id, name FROM staff WHERE id=?', [staffId]);

		if (staff && staff.name === 'Cover') {
			return context.json({
				error: 'Cover staff is system-defined and cannot be deleted'
			}, 400);
		}

		await runSql(context.env.DB, 'DELETE FROM staff WHERE id=?', [staffId]);
		return context.json({ ok: true });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/* -----------------------------
   Admin CRUD (webapp login)
----------------------------- */
app.get('/api/admins', authMiddleware, async context => {
	try {
		let rows = await allSql(
			context.env.DB,
			'SELECT * FROM admin'
		);
		rows = rows.results || [];
		return context.json(rows);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.get('/api/admins/:id', authMiddleware, async context => {
	try {
		let row = await getSql(
			context.env.DB,
			'SELECT * FROM admin WHERE id=?',
			[context.req.param().id]
		);
		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.post('/api/admins', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const body = await context.req.json();
		const { name, email, password_hash } = body;

		const hashedPassword = password_hash
			? await bcrypt.hash(password_hash, 10)
			: null;

		await runSql(
			context.env.DB,
			'INSERT INTO admin (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
			[id, name, email, hashedPassword]
		);
		let row = await getSql(context.env.DB, 'SELECT * FROM admin WHERE id=?', [id]);
		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.put('/api/admins/:id', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const { name, email, password_hash } = body;
		const hashedPassword = password_hash
			? await bcrypt.hash(password_hash, 10)
			: null;

		await runSql(
			context.env.DB,
			'UPDATE admin SET name=?, email=?, password_hash=? WHERE id=?',
			[name, email, hashedPassword, context.req.param().id]
		);
		let row = await getSql(context.env.DB, 'SELECT * FROM admin WHERE id=?', [context.req.param().id]);
		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.delete('/api/admins/:id', authMiddleware, async context => {
	try {
		const adminId = context.req.param().id;
		await runSql(context.env.DB, 'DELETE FROM admin WHERE id=?', [adminId]);
		return context.json({ ok: true });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/* -----------------------------
👥 Teams Members CRUD
----------------------------- */
app.get('/api/team_members', authMiddleware, async context => {
	try {
		let team_members = await allSql(
			context.env.DB,
			`SELECT tm.id, tm.team_id, tm.staff_id, s.name, s.email, s.role
			FROM team_members tm
			JOIN staff s ON tm.staff_id = s.id;`
		);

		team_members = team_members.results || [];

		return context.json(team_members);
	} catch (e) { 
		return context.json({ error: e.message }, 500); 
	}
});

/* -----------------------------
👥 Teams CRUD (with members)
----------------------------- */
app.get('/api/teams', authMiddleware, async context => {
	try {
		let teams = await allSql(
			context.env.DB,
			`SELECT t.*, s.name AS supervisor_name, s.id AS supervisor_id,
			(SELECT COUNT(id) FROM team_members WHERE team_id = t.id) AS member_count
			FROM teams t
			LEFT JOIN staff s ON t.supervisor_id = s.id
			GROUP BY t.id;`
		);

		teams = teams.results || [];

		return context.json(teams);
	} catch (e) { 
		return context.json({ error: e.message }, 500); 
	}
});

app.get('/api/teams/:id', authMiddleware, async context => {
	try {
		let team = await getSql(
			context.env.DB,
			`SELECT t.*, s.name AS supervisor_name, s.id AS supervisor_id
			FROM teams t
			LEFT JOIN staff s ON t.supervisor_id = s.id
			WHERE t.id=?`, [context.req.param().id]
		);

		

		let members = await allSql(
			context.env.DB,
			`SELECT tm.staff_id, s.name, s.role
			FROM team_members tm
			LEFT JOIN staff s ON tm.staff_id = s.id
			WHERE tm.team_id=?
			`, [context.req.param().id]
		);

		members = members.results || [];

		team.member_count = members?.length || 0;

		return context.json({ ...team, members });
	} catch (e) { 
		return context.json({ error: e.message }, 500); 
	}
});

app.post('/api/teams', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const body = await context.req.json();
		const { name, description, status, supervisor_id, member_ids = [] } = body;
		await runSql(context.env.DB, 'INSERT INTO teams (id, name, supervisor_id) VALUES (?, ?, ?)', [id, name, supervisor_id]);

		for (const mid of member_ids) {
			await runSql(context.env.DB, 'INSERT INTO team_members (id, team_id, staff_id) VALUES (?, ?, ?)', [uuidv4(), id, mid]);
		}

		let team = await getSql(context.env.DB, 'SELECT * FROM teams WHERE id=?', [id]);
		

		return context.json({ ...team, members: member_ids });
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.put('/api/teams/:id', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const { name, description, status, supervisor_id, member_ids = [] } = body;
		await runSql(context.env.DB, 'UPDATE teams SET name=?, supervisor_id=? description=? status=? WHERE id=?', [name, supervisor_id, description, status, context.req.param().id]);

		// Reset members
		await runSql(context.env.DB, 'DELETE FROM team_members WHERE team_id=?', [context.req.param().id]);
		for (const mid of member_ids) {
			await runSql(context.env.DB, 'INSERT INTO team_members (id, team_id, staff_id) VALUES (?, ?, ?)', [uuidv4(), context.req.param().id, mid]);
		}

		let team = await getSql(
			context.env.DB, 
			`SELECT t.*, s.name AS supervisor_name, s.id AS supervisor_id,
			(SELECT COUNT(id) FROM team_members WHERE team_id = t.id) AS member_count
			FROM teams t
			LEFT JOIN staff s ON t.supervisor_id = s.id
			WHERE t.id=?`, 
			[context.req.param().id]
		);
		


		return context.json({ ...team, members: member_ids });
	} catch (e) { 
		return context.json({ error: e.message }, 500); }
});

app.delete('/api/teams/:id', authMiddleware, async context => {
	try {
		await runSql(context.env.DB, 'DELETE FROM team_members WHERE team_id=?', [context.req.param().id]);
		await runSql(context.env.DB, 'DELETE FROM teams WHERE id=?', [context.req.param().id]);
		return context.json({ ok: true });
	} catch (e) { 
		return context.json({ error: e.message }, 500); }
});

/* -----------------------------
   🧾 Clients CRUD
----------------------------- */
app.get('/api/clients', authMiddleware, async context => {
	try {
		// console.log('In GET Clients');
		let rows = await allSql(context.env.DB, 'SELECT * FROM clients');

		rows = rows.results || [];
		// console.log(rows);

		return context.json(rows);
	} catch (e) { 
		return context.json({ error: e.message }, 500); 
	}
});

app.get('/api/clients/:id', authMiddleware, async context => {
	try {
		let rows = await getSql(context.env.DB, 'SELECT * FROM clients WHERE id=?', [context.req.param().id]);
		

		return context.json(rows);
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.post('/api/clients', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const body = await context.req.json();
		const { client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information } = body;
		await runSql(
			context.env.DB,
			'INSERT INTO clients (id, client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information) VALUES (?,?,?,?,?,?,?,?,?,?)',
			[id, client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information]
		);

		let row = await getSql(
			context.env.DB,
			'SELECT * FROM clients WHERE id=?', 
			[id]
		);
		

		return context.json(row);
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.put('/api/clients/:id', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const { client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information } = body;
		await runSql(
			context.env.DB,
			'UPDATE clients SET client_name=?, company=?, email=?, phone=?, abn=?, acn=?, client_instruction=?, client_information=?, property_information=? WHERE id=?',
			[client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information, context.req.param().id]
		);

		let row = await getSql(context.env.DB, 'SELECT * FROM clients WHERE id=?', [context.req.param().id]);
		


		return context.json(row);
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.delete('/api/clients/:id', authMiddleware, async context => {
	try {
		await runSql(context.env.DB, 'DELETE FROM clients WHERE id=?', [context.req.param().id]);
		return context.json({ ok: true });
	} catch (e) { return context.json({ error: e.message }, 500); }
});

/* -----------------------------
   📍 Locations CRUD
----------------------------- */
app.get('/api/locations', authMiddleware, async context => {
	try {
		let rows = await allSql(context.env.DB, 'SELECT * FROM locations');
		rows = rows.results || [];

		return context.json(rows);
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.get('/api/locations/:id', authMiddleware, async context => {
	try {
		let row = await getSql(context.env.DB, 'SELECT * FROM locations WHERE id=?', [context.req.param().id]);
		

		return context.json(row);
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.post('/api/locations', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const body = await context.req.json();
		const { title, address, lat, lng, unit_no, radius_meters, comment } = body;
		await runSql(
			context.env.DB,
			'INSERT INTO locations (id, title, address, lat, lng, unit_no, radius_meters, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			[id, title, address, lat, lng, unit_no, radius_meters, comment]
		);

		let row = await getSql(context.env.DB, 'SELECT * FROM locations WHERE id=?', [id]);
		

		return context.json(row);
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.put('/api/locations/:id', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const { title, address, lat, lng, unit_no, radius_meters, comment } = body;
		await runSql(
			context.env.DB,
			'UPDATE locations SET title=?, address=?, lat=?, lng=?, unit_no=?, radius_meters=?, comment=? WHERE id=?',
			[title, address, lat, lng, unit_no, radius_meters, comment, context.req.param().id]
		);

		let row = await getSql(context.env.DB, 'SELECT * FROM locations WHERE id=?', [context.req.param().id]);
		

		return context.json(row);
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.delete('/api/locations/:id', authMiddleware, async context => {
	try {
		await runSql(context.env.DB, 'DELETE FROM locations WHERE id=?', [context.req.param().id]);
		return context.json({ ok: true });
	} catch (e) { return context.json({ error: e.message }, 500); }
});

/* -----------------------------
   📋 Tasks CRUD (All Columns)
----------------------------- */
app.get('/api/tasks', authMiddleware, async context => {
	try {

		const { from, to } = context.req.query();
		const appTimezone = getRequestTimezone(context.req, context.env);
		const where = [];
		const params = [];
		const { fromUtc, toUtcExclusive } = buildUtcRangeFromLocalDates({
			from,
			to,
			timezoneName: appTimezone,
			inclusiveTo: false
		});

		if (fromUtc) {
			where.push('t.start_time >= ?');
			params.push(fromUtc);
		}

		if (toUtcExclusive) {
			where.push('t.start_time < ?');
			params.push(toUtcExclusive);
		}

		let rows = await allSql(
			context.env.DB,
			`SELECT t.*, s.name AS staff_name, c.client_name AS client_name, l.title AS location_title, tm.name AS team_supervisor,
			l.lat AS location_lat, l.lng AS location_lng, l.unit_no AS location_unit_no, l.radius_meters AS location_radius_meters, l.comment AS location_comment
			FROM tasks t
			LEFT JOIN staff s ON t.staff_id = s.id
			LEFT JOIN clients c ON t.client_id = c.id
			LEFT JOIN locations l ON t.location_id = l.id
			LEFT JOIN teams te ON t.team_id = te.id
			LEFT JOIN staff tm ON te.supervisor_id = tm.id
			${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, params
		);

		rows = rows.results || [];

		// console.log('In GET Tasks rows');
		// console.log(rows);

		// Add task_team_members for each task
		for (const task of rows) {

			
			let teamMembers = await allSql(context.env.DB, 'SELECT  ttm.staff_id, s.name AS staff_name FROM task_team_members ttm JOIN staff s ON s.id = ttm.staff_id WHERE ttm.task_id = ?;', [task.id]);

			teamMembers = teamMembers.results || [];
			// console.log('In GET Tasks', teamMembers);
			if (teamMembers && teamMembers.length > 0) {
				task.task_team_members = teamMembers.map(tm => tm.staff_id);
				task.task_team_members_name = teamMembers.map(tm => tm.staff_name);
			}
		}

		return context.json(rows);
	} catch (e) { return context.json({ error: e.message }, 500); }
});

app.get('/api/tasks/:id', authMiddleware, async context => {
	try {
		let task = await getSql(context.env.DB, 'SELECT * FROM tasks WHERE id = ?', [context.req.param().id]);
		

		if (!task) {
			return context.json({ error: 'Task not found' }, 404);
		}

		let teamMembers = await allSql(
			context.env.DB, 
			'SELECT tm.staff_id as staff_id, s.name AS staff_name FROM task_team_members tm JOIN staff s ON s.id = tm.staff_id WHERE task_id = ?', 
			[context.req.param().id]
		);

		teamMembers = teamMembers.results || [];
		
		task.task_team_members = teamMembers.map(tm => tm.staff_id);
		task.task_team_members_name = teamMembers.map(tm => tm.staff_name);

		return context.json(task);
	} catch (error) {
		return context.json({ error: error.message }, 500);
	}
});

// app.get('/api/tasks/:id', authMiddleware, async context => {
//   try {
//     let rows = await getSql(`
//       SELECT t.*, s.name AS staff_name, c.client_name, l.title AS location_title, tm.name AS team_supervisor
//       FROM tasks t
//       LEFT JOIN staff s ON t.staff_id = s.id
//       LEFT JOIN clients c ON t.client_id = c.id
//       LEFT JOIN locations l ON t.location_id = l.id
//       LEFT JOIN teams te ON t.team_id = te.id
//       LEFT JOIN staff tm ON te.supervisor_id = tm.id
//       WHERE id=?
//     `, [context.req.param().id]);
//     return context.json(rows);
//   } catch (e) { return context.json({ error: e.message }, 500); }
// });

app.post('/api/tasks', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const body = await context.req.json();
		const fields = [
			'task_name', 'assignment_type', 'staff_id', 'team_id', 'client_id', 'location_id',
			'start_time', 'end_time', 'publish', 'shift_instructions', 'color',
			'isLocation',
			'started_at', 'stopped_at', 'travel_from', 'travel_dist', 'travel_duration',
			'pay_length_minutes',
			'payment_type', 'payment_amount', 'payment_date',
			'task_client_name', 'task_client_company', 'task_client_email', 'task_client_phone',
			'task_client_abn', 'task_client_acn', 'task_client_instruction',
			'task_client_information', 'task_client_property_information'
		];
		const values = fields.map(k => body[k] || null);

		await runSql(
			context.env.DB,
			`INSERT INTO tasks (${fields.join(',')}, id)
       		VALUES (${fields.map(() => '?').join(',')}, ?)`,
			[...values, id]
		);

		// Handle task_team_members if provided
		if (Array.isArray(body.task_team_members)) {
			for (const staffId of body.task_team_members) {
				await runSql(
					context.env.DB,
					'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?, ?, ?, ?)',
					[uuidv4(), null, id, staffId]
				);
			}
		}

		let row = await getSql(context.env.DB, 'SELECT * FROM tasks WHERE id=?', [id]);

		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.put('/api/tasks/:id', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const taskId = context.req.param().id;

		const fields = [
			'task_name', 'assignment_type', 'staff_id', 'team_id', 'client_id', 'location_id',
			'start_time', 'end_time', 'publish', 'shift_instructions', 'color',
			'isLocation',
			'started_at', 'stopped_at', 'travel_from', 'travel_dist', 'travel_duration',
			'pay_length_minutes',
			'payment_type', 'payment_amount', 'payment_date',
			'task_client_name', 'task_client_company', 'task_client_email', 'task_client_phone',
			'task_client_abn', 'task_client_acn', 'task_client_instruction',
			'task_client_information', 'task_client_property_information'
		];

		// ✅ Only include fields that exist in request body
		const updateFields = fields.filter(f => Object.prototype.hasOwnProperty.call(body, f));

		if (updateFields.length > 0) {
			const setClause = updateFields.map(f => `${f}=?`).join(', ');
			const values = updateFields.map(f => body[f]);

			await runSql(
				context.env.DB,
				`UPDATE tasks SET ${setClause} WHERE id=?`,
				[...values, taskId]
			);
		}

		// ✅ Only reset team members if provided
		if (Object.prototype.hasOwnProperty.call(body, 'task_team_members')) {

			// Delete existing
			await runSql(
				context.env.DB,
				'DELETE FROM task_team_members WHERE task_id=?',
				[taskId]
			);

			// Insert new ones
			if (Array.isArray(body.task_team_members)) {
				for (const staffId of body.task_team_members) {
					if (staffId) {
						await runSql(
							context.env.DB,
							'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?, ?, ?, ?)',
							[uuidv4(), null, taskId, staffId]
						);
					}
				}
			}
		}

		const row = await getSql(
			context.env.DB,
			'SELECT * FROM tasks WHERE id=?',
			[taskId]
		);

		return context.json(row);

	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.post('/api/publishtasks', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const taskIds = Array.isArray(body?.taskIds)
			? [...new Set(body.taskIds.map(id => `${id}`.trim()).filter(Boolean))]
			: [];

		if (taskIds.length === 0) {
			return context.json({ error: 'taskIds array is required' }, 400);
		}

		const placeholders = taskIds.map(() => '?').join(', ');
		const updateResult = await runSql(
			context.env.DB,
			`UPDATE tasks
			 SET publish = 1
			 WHERE id IN (${placeholders})
			   AND COALESCE(publish, 0) != 1`,
			taskIds
		);

		return context.json({
			ok: true,
			updated: updateResult?.meta?.changes ?? taskIds.length
		});
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});


app.delete('/api/tasks/:id', authMiddleware, async context => {
	try {
		await runSql(context.env.DB, 'DELETE FROM task_staff_travel WHERE task_id=?', [context.req.param().id]);
		await runSql(context.env.DB, 'DELETE FROM task_team_members WHERE task_id=?', [context.req.param().id]);
		await runSql(context.env.DB, 'DELETE FROM tasks WHERE id=?', [context.req.param().id]);
		return context.json({ ok: true });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/**
 * Assign task to static Cover staff instead of deleting
 */
app.post('/api/tasks/:id/assign-to-cover', authMiddleware, async context => {
	try {
		const taskId = context.req.param().id;

		// Ensure Cover staff exists
		let coverStaff = await getSql(
			context.env.DB,
			"SELECT id FROM staff WHERE id = 'STATIC-COVER-STAFF' OR name = 'Cover'"
		);


		if (!coverStaff) {
			return context.json({
				error: 'Cover staff not found'
			}, 500);
		}

		// Update task assignment to Cover
		await runSql(
			context.env.DB,
			`UPDATE tasks
			SET staff_id = ?, team_id = NULL, assignment_type = 'staff', travel_from = NULL, travel_dist = NULL, travel_duration = NULL
			WHERE id = ?`,
			[coverStaff.id, taskId]
		);

		// Remove any team members linked to the task
		await runSql(
			context.env.DB,
			'DELETE FROM task_team_members WHERE task_id = ?',
			[taskId]
		);

		await runSql(
			context.env.DB,
			'DELETE FROM task_staff_travel WHERE task_id = ?',
			[taskId]
		);

		// const updatedTask = await getSql(
		//   'SELECT * FROM tasks WHERE id = ?',
		//   [taskId]
		// );

		// if (!updatedTask) {
		//   return return context.status(404).json({ error: 'Task not found' });
		// }

		return context.json({
			ok: true,
			message: 'Task assigned to Cover staff',
			// task: updatedTask
		});
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/**
 * Start task (set started_at)
 */
app.post('/api/tasks/:id/start', authMiddleware, async context => {
	try {
		const taskId = context.req.param().id;
		let body = {};
		try {
			let bodyText = await context.req.text();
			console.log('In start task ' + taskId, bodyText);
			body = await context.req.json();
		} catch (e) {

			console.error('In start task error', e);
			body = {};
		}

		console.log('In start task ' + taskId, JSON.stringify(body));
		const { lat, lng } = body || {};
		const task = await getSql(context.env.DB, 'SELECT id FROM tasks WHERE id = ?', [taskId]);
		if (!task) {
			return context.json({ error: 'Task not found' }, 404);
		}
		const now = new Date().toISOString();
		await runSql(
			context.env.DB,
			'UPDATE tasks SET started_at = ?, start_lat = ?, start_lng = ? WHERE id = ?',
			[now, lat ?? null, lng ?? null, taskId]
		);
		const updated = await getSql(context.env.DB, 'SELECT * FROM tasks WHERE id = ?', [taskId]);
		return context.json({ ok: true, task: updated });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/**
 * End task (set stopped_at)
 */
app.post('/api/tasks/:id/end', authMiddleware, async context => {
	try {
		const taskId = context.req.param().id;
		let body = {};
		try {
			let bodyText = await context.req.text();
			console.log('In end task ' + taskId, bodyText);
			body = await context.req.json();
		} catch (e) {
			console.error('In end task error', e);
			body = {};
		}

		console.log('In end task ' + taskId, JSON.stringify(body));

		const { lat, lng } = body || {};
		const task = await getSql(
			context.env.DB,
			'SELECT id, start_time, end_time, started_at FROM tasks WHERE id = ?',
			[taskId]
		);
		if (!task) {
			return context.json({ error: 'Task not found' }, 404);
		}
		const now = new Date().toISOString();
		const payMins = computePayLengthMinutes({
			start_time: task.start_time,
			end_time: task.end_time,
			started_at: task.started_at,
			stopped_at: now
		});

		console.log('In end task ' + taskId, 'payMins', payMins);
		await runSql(
			context.env.DB,
			'UPDATE tasks SET stopped_at = ?, end_lat = ?, end_lng = ?, pay_length_minutes = ? WHERE id = ?',
			[now, lat ?? null, lng ?? null, payMins, taskId]
		);

		console.log('In end task ' + taskId, 'payMins', typeof(payMins));

		const updated = await getSql(context.env.DB, 'SELECT * FROM tasks WHERE id = ?', [taskId]);
		return context.json({ ok: true, task: updated });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/* -----------------------------
   📋 Task Instructions Tasks
----------------------------- */
app.get('/api/task_instructions/:taskid', authMiddleware, async context => {
	try {
		let taskInstructions = await allSql(context.env.DB, 'SELECT * FROM task_instructions WHERE task_id = ?', [context.req.param().taskid]);
		taskInstructions = taskInstructions.results || [];
		
		if (!taskInstructions) {
			return context.json({ error: 'taskInstructions not found' }, 404);
		}
		return context.json(taskInstructions);
	} catch (error) {
		return context.json({ error: error.message }, 500);
	}
});

app.post('/api/task_instructions/bulk', authMiddleware, async c => {
	try {
		const body = await c.req.json()
		const { taskIds } = body

		if (!Array.isArray(taskIds) || taskIds.length === 0) {
			return c.json({ error: 'taskIds is required' }, 400)
		}

		const placeholders = taskIds.map(() => '?').join(',')
		const { results } = await c.env.DB
			.prepare(`SELECT * FROM task_instructions WHERE task_id IN (${placeholders})`)
			.bind(...taskIds)
			.all()

		return c.json(results)
	} catch (e) {
		console.error('Bulk task_instructions error', e)
		return c.json({ error: e.message }, 500)
	}
})

app.post('/api/task_instructions', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const body = await context.req.json();
		const fields = ['task_id', 'ques', 'resp_type', 'reply', 'replied_at', 'is_read'];
		const values = fields.map(k => {
			if (k === 'is_read') {
				const v = body[k];
				if (v === true || v === 1 || v === '1') return 1;
				return 0;
			}
			return body[k] || null;
		});

		await runSql(
			context.env.DB,
			`INSERT INTO task_instructions (${fields.join(',')}, id)
       		VALUES (${fields.map(() => '?').join(',')}, ?)`,
			[...values, id]
		);

		let row = await getSql(context.env.DB, 'SELECT * FROM task_instructions WHERE id=?', [id]);
		

		return context.json(row);
	} catch (error) {
		return context.json({ error: error.message }, 500);
	}
});

app.put('/api/task_instructions/:id', authMiddleware, async context => {
	try {
		const fields = ['task_id', 'ques', 'resp_type', 'reply', 'replied_at', 'is_read'];
		const body = await context.req.json();

		const setClause = fields.map(f => `${f}=?`).join(', ');
		const values = fields.map(k => {
			if (k === 'is_read') {
				const v = body[k];
				if (v === true || v === 1 || v === '1') return 1;
				if (v === false || v === 0 || v === '0') return 0;
				return v == null ? 0 : 1;
			}
			return body[k] || null;
		});

		await runSql(context.env.DB, `UPDATE task_instructions SET ${setClause} WHERE id=?`, [...values, context.req.param().id]);

		let row = await getSql(context.env.DB, 'SELECT * FROM task_instructions WHERE id=?', [context.req.param().id]);
		

		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.put('/api/taskinstructions/bulk-update', authMiddleware, async context => {
	try {
		console.log('in bulk-update', context.req);

		const body = await context.req.json();

		console.log('bulk-update body', body);

		if (!Array.isArray(body)) {
			return context.json({ error: 'Request body must be an array' }, 400);
		}

		const fields = ['task_id', 'ques', 'resp_type', 'reply', 'replied_at', 'is_read'];

		for (let instructionObj of body) {

			if (!instructionObj.id) continue;

			// ✅ Only update provided fields
			const updateFields = fields.filter(f =>
				Object.prototype.hasOwnProperty.call(instructionObj, f)
			);

			// Skip if nothing to update
			if (updateFields.length === 0) continue;

			const setClause = updateFields.map(f => `${f}=?`).join(', ');
			const values = updateFields.map(f => {
				if (f === 'is_read') {
					const v = instructionObj[f];
					if (v === true || v === 1 || v === '1') return 1;
					if (v === false || v === 0 || v === '0') return 0;
					return 0;
				}
				return instructionObj[f];
			});

			await runSql(
				context.env.DB,
				`UPDATE task_instructions SET ${setClause} WHERE id=?`,
				[...values, instructionObj.id]
			);
		}

		return context.json({ success: true });

	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/**
 * Set is_read on a task instruction (body: { isRead } or { is_read }, default mark read).
 */
app.patch('/api/task_instructions/:id/read', authMiddleware, async context => {
	try {
		const id = context.req.param().id;
		let body = {};
		try {
			body = await context.req.json();
		} catch {
			body = {};
		}
		const raw = body.isRead !== undefined ? body.isRead : body.is_read;
		const isRead =
			raw === false || raw === 0 || raw === '0' || raw === 'false' ? 0 : 1;

		const existing = await getSql(context.env.DB, 'SELECT id FROM task_instructions WHERE id = ?', [id]);
		if (!existing) {
			return context.json({ error: 'Task instruction not found' }, 404);
		}

		await runSql(context.env.DB, 'UPDATE task_instructions SET is_read = ? WHERE id = ?', [isRead, id]);
		const row = await getSql(context.env.DB, 'SELECT * FROM task_instructions WHERE id = ?', [id]);
		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.delete('/api/task_instructions/:id', authMiddleware, async context => {
	try {
		await runSql(context.env.DB, 'DELETE FROM task_instructions WHERE id=?', [context.req.param().id]);
		return context.json({ ok: true });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});



/* -----------------------------
   📋 Recurring Tasks
----------------------------- */

/**
 * Get recurring task settings for a parent task
 */
app.get("/api/recurring/:taskId", authMiddleware, async context => {
	try {
		let recurringTaskSettingsForTask = await allSql(context.env.DB, "SELECT * FROM recurring_task_settings WHERE parent_task = ?", [context.req.param().taskId]);
		recurringTaskSettingsForTask = recurringTaskSettingsForTask.results || [];

		if (!recurringTaskSettingsForTask || recurringTaskSettingsForTask.length === 0) {
			return context.json({});
		}

		let settingIds = [];
		for (let recurringTaskSettingForTask of recurringTaskSettingsForTask) {
			settingIds.push(recurringTaskSettingForTask.id);
		}

		// Build dynamic placeholders for IN clause
		const placeholders = settingIds.map(() => '?').join(',');

		// Fetch all child tasks for all recurring settings
		let children = await allSql(
			context.env.DB,
			`SELECT id, start_time, end_time, team_id, staff_id, client_id, location_id, isLocation
			FROM tasks
			WHERE recurring_settings IN (${placeholders})
			ORDER BY start_time`,
			settingIds
		);

		children = children.results || [];

		return context.json({ row: recurringTaskSettingsForTask, children });
	} catch (err) {
		return context.json({ error: err.message }, 500);
	}
});

app.get('/api/recurring_setting/:id', authMiddleware, async context => {
	try {
		const recId = context.req.param().id;
		let recurringTaskSettings = await getSql(context.env.DB, "SELECT * FROM recurring_task_settings WHERE id = ?", [recId]);

		if (!recurringTaskSettings) {
			return context.json({ error: 'Recurring task settings not found' }, 404);
		}

		return context.json({ row: recurringTaskSettings });
	} catch (err) {
		return context.json({ error: err.message }, 500);
	}
});

/**
 * Delete recurring task settings
 */
// app.delete('/api/recurring/:id', authMiddleware, async context => {
//   try {
//     const recId = context.req.param().id;
//     // delete generated tasks first
//     await runSql('DELETE FROM tasks WHERE recurring_settings = ?', [recId]);
//     // delete recurring settings
//     await runSql('DELETE FROM recurring_task_settings WHERE id = ?', [recId]);
//     return context.json({ ok: true });
//   } catch (e) {
//     console.error('delete recurring error', e);
//     return context.json({ error: e.message }, 500);
//   }
// });

app.delete('/api/recurring_setting/:id', authMiddleware, async context => {
	try {
		const recId = context.req.param().id;
		const body = await context.req.json().catch(() => ({}));
		const requestedDate = body?.date || body?.from_date || null;
		const appTimezone = getRequestTimezone(context.req, context.env);
		const changeFromIso = requestedDate
			? getUtcStartOfLocalDay(requestedDate, appTimezone)
			: getUtcStartOfLocalDay(dayjs().tz(appTimezone), appTimezone);
		const closeDateBeforeChange = getUtcEndOfPreviousLocalDay(changeFromIso, appTimezone);

		let futureTasks = await allSql(
			context.env.DB,
			`SELECT id FROM tasks
       WHERE recurring_settings = ?
       AND start_time >= ?`,
			[recId, changeFromIso]
		);

		futureTasks = futureTasks.results || [];

		for (const task of futureTasks) {
			await runSql(context.env.DB, 'DELETE FROM task_staff_travel WHERE task_id = ?', [task.id]);
			await runSql(context.env.DB, 'DELETE FROM task_team_members WHERE task_id = ?', [task.id]);
			await runSql(context.env.DB, 'DELETE FROM tasks WHERE id = ?', [task.id]);
		}

		let remainingTasks = await allSql(
			context.env.DB,
			`SELECT start_time FROM tasks
			 WHERE recurring_settings = ?
			 ORDER BY start_time ASC`,
			[recId]
		);
		remainingTasks = remainingTasks.results || [];
		const firstRemainingTask = remainingTasks[0] || null;
		const closeDateComparison = firstRemainingTask
			? compareLocalDays(closeDateBeforeChange, firstRemainingTask.start_time, appTimezone)
			: null;
		const shouldDeleteRecurringSetting =
			!firstRemainingTask ||
			closeDateComparison === 0 ||
			closeDateComparison === -1;

		if (shouldDeleteRecurringSetting) {
			await runSql(context.env.DB, 'DELETE FROM recurring_task_settings WHERE id = ?', [recId]);
		} else {
			await runSql(
				context.env.DB,
				'UPDATE recurring_task_settings SET close_date=? WHERE id = ?',
				[closeDateBeforeChange, recId]
			);
		}

		return context.json({ ok: true, deletedTasks: futureTasks.length, change_from_date: changeFromIso });
	} catch (e) {
		console.error('delete recurring setting error', e);
		return context.json({ error: e.message }, 500);
	}
});

app.put('/api/recurring_setting/:id/tasks', authMiddleware, async context => {
	try {
		const recId = context.req.param().id;
		// let transactionStarted = false;
		const appTimezone = getRequestTimezone(context.req, context.env);

		const body = await context.req.json();

		const {
			date,
			from_date,
			team_id,
			staff_id,
			task_team_members,
			client_fields,
			new_start_time,
			new_end_time,
			duration_minutes,
			location_id
		} = body;

		const requestedDate = date || from_date;
		const changeFromIso = requestedDate
			? getUtcStartOfLocalDay(requestedDate, appTimezone)
			: getUtcStartOfLocalDay(dayjs().tz(appTimezone), appTimezone);

		const existingSetting = await getSql(
			context.env.DB,
			'SELECT * FROM recurring_task_settings WHERE id=?',
			[recId]
		);

		if (!existingSetting) {
			return context.json({ error: 'Recurring task settings not found' }, 404);
		}

		/** Only shifts not yet finished (no stopped_at) are changed by recurring bulk updates. */
		const notCompletedSql = `(stopped_at IS NULL OR stopped_at = '')`;

		let tasks = await allSql(
			context.env.DB,
			`SELECT id FROM tasks
			WHERE recurring_settings = ?
			AND start_time >= ?
			AND ${notCompletedSql}
			ORDER BY start_time`,
			[recId, changeFromIso]
		);

		tasks = tasks.results || [];

		if (tasks.length === 0) {
			return context.json({ ok: true, updated: 0 });
		}

		// transactionStarted = true;

		// Compute updated details/task_length for the NEW recurring_task_settings row.
		let newTaskLength = existingSetting.task_length;
		const durationMinutesNum =
			duration_minutes != null && duration_minutes !== ''
				? Math.floor(Number(duration_minutes))
				: null;
		const hasDurationUpdate =
			durationMinutesNum != null &&
			Number.isFinite(durationMinutesNum) &&
			durationMinutesNum > 0;

		if (hasDurationUpdate) {
			newTaskLength = String(durationMinutesNum);
		} else if (new_start_time && new_end_time) {
			const lengthMinutes = diffClockMinutes(new_start_time, new_end_time);

			if (lengthMinutes != null) {
				newTaskLength = String(lengthMinutes);
			}
		}

		let newDetails = existingSetting.details || "";
		if (team_id || staff_id) {
			let detailsStr = "";

			if (team_id) {
				const team = await getSql(context.env.DB,'SELECT name FROM teams WHERE id=?', [team_id]);
				detailsStr = team?.name ? team.name : "";
			} else if (staff_id) {
				const st = await getSql(context.env.DB,'SELECT name FROM staff WHERE id=?', [staff_id]);
				if (st?.name) {
					detailsStr = st.name + " (S)";
				}
			}

			let memberNames = [];
			if (Array.isArray(task_team_members)) {
				for (const mid of task_team_members) {
					const st = await getSql(context.env.DB,'SELECT name FROM staff WHERE id=?', [mid]);
					if (st?.name) memberNames.push(st.name);
				}
			}

			if (detailsStr && memberNames.length > 0) {
				detailsStr = detailsStr + " - " + memberNames.join(", ");
			} else if (!detailsStr) {
				detailsStr = memberNames.join(", ");
			}

			newDetails = detailsStr;
		}

		// Create a new recurring_task_settings row and link affected tasks to it.
		const newRecId = uuidv4();
		await runSql(
			context.env.DB,
			`INSERT INTO recurring_task_settings
			(id, request_freq, monday, tuesday, wednesday, thrusday, friday, saturday, sunday,
				occurrences, close_date, parent_task, task_length, details)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			[
				newRecId,
				existingSetting.request_freq,
				existingSetting.monday,
				existingSetting.tuesday,
				existingSetting.wednesday,
				existingSetting.thrusday,
				existingSetting.friday,
				existingSetting.saturday,
				existingSetting.sunday,
				existingSetting.occurrences ?? null,
				existingSetting.close_date ?? null,
				existingSetting.parent_task,
				newTaskLength,
				newDetails
			]
		);

		await runSql(
			context.env.DB,
			`UPDATE tasks SET recurring_settings=?
			WHERE recurring_settings=? AND start_time >= ?
			AND ${notCompletedSql}`,
			[newRecId, recId, changeFromIso]
		);

		let remainingTasks = await allSql(
			context.env.DB,
			`SELECT start_time FROM tasks
			 WHERE recurring_settings = ?
			 ORDER BY start_time ASC`,
			[recId]
		);
		remainingTasks = remainingTasks.results || [];

		const closeDateBeforeChange = getUtcEndOfPreviousLocalDay(changeFromIso, appTimezone);
		const firstRemainingTask = remainingTasks[0] || null;
		const closeDateComparison = firstRemainingTask
			? compareLocalDays(closeDateBeforeChange, firstRemainingTask.start_time, appTimezone)
			: null;
		const shouldDeleteRecurringSetting =
			!firstRemainingTask ||
			closeDateComparison === 0 ||
			closeDateComparison === -1;

		if (shouldDeleteRecurringSetting) {
			await runSql(context.env.DB, 'DELETE FROM recurring_task_settings WHERE id = ?', [recId]);
		} else {
			await runSql(
				context.env.DB,
				'UPDATE recurring_task_settings SET close_date=? WHERE id = ?',
				[closeDateBeforeChange, recId]
			);
		}



		for (const t of tasks) {
			const taskId = t.id;

			if (team_id) {
				await runSql(context.env.DB, 'UPDATE tasks SET assignment_type=?, team_id=?, staff_id=? WHERE id=?', ["team", team_id, staff_id, taskId]);
				await runSql(context.env.DB, 'DELETE FROM task_team_members WHERE task_id=?', [taskId]);

				if (Array.isArray(task_team_members)) {
					for (const mid of task_team_members) {
						await runSql(
							context.env.DB,
							'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?,?,?,?)',
							[uuidv4(), team_id, taskId, mid]
						);
					}
				}
			} else if (staff_id) {
				await runSql(context.env.DB, 'UPDATE tasks SET staff_id=?, team_id=NULL WHERE id=?', [staff_id, taskId]);
				await runSql(context.env.DB, 'DELETE FROM task_team_members WHERE task_id=?', [taskId]);

				if (Array.isArray(task_team_members)) {
					for (const mid of task_team_members) {
						await runSql(
							context.env.DB,
							'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?,?,?,?)',
							[uuidv4(), team_id, taskId, mid]
						);
					}
				}
			}

			if (client_fields) {
				const {
					task_client_name,
					task_client_company,
					task_client_email,
					task_client_phone,
					task_client_abn,
					task_client_acn,
					task_client_instruction,
					task_client_information,
					task_client_property_information
				} = client_fields;

				await runSql(
					context.env.DB,
					`UPDATE tasks SET
					task_client_name=?,
					task_client_company=?,
					task_client_email=?,
					task_client_phone=?,
					task_client_abn=?,
					task_client_acn=?,
					task_client_instruction=?,
					task_client_information=?,
					task_client_property_information=?
					WHERE id=?`,
					[
						task_client_name,
						task_client_company,
						task_client_email,
						task_client_phone,
						task_client_abn,
						task_client_acn,
						task_client_instruction,
						task_client_information,
						task_client_property_information,
						taskId
					]
				);
			}

			if (hasDurationUpdate) {
				let existingTask = await getSql(
					context.env.DB,
					'SELECT start_time FROM tasks WHERE id=?',
					[taskId]
				);

				if (existingTask?.start_time) {
					const existingStartLocal = toZonedDateTime(existingTask.start_time, appTimezone);
					if (existingStartLocal) {
						const localEnd = existingStartLocal.add(durationMinutesNum, 'minute');
						const updatedEnd = localEnd.utc().toISOString();
						await runSql(
							context.env.DB,
							'UPDATE tasks SET end_time=? WHERE id=?',
							[updatedEnd, taskId]
						);
					}
				}
			} else if (new_start_time && new_end_time) {
				// Fetch existing task times (date + time)
				let existingTask = await getSql(
					context.env.DB,
					'SELECT start_time, end_time FROM tasks WHERE id=?',
					[taskId]
				);

				if (existingTask?.start_time && existingTask?.end_time) {
					const existingStartLocal = toZonedDateTime(existingTask.start_time, appTimezone);
					const startDateText = existingStartLocal?.format('YYYY-MM-DD');
					const endDayOffset = new_end_time < new_start_time ? 1 : 0;
					const endDateText = existingStartLocal
						? existingStartLocal.add(endDayOffset, 'day').format('YYYY-MM-DD')
						: null;

					const updatedStart = combineLocalDateAndTimeToUtcIso({
						dateValue: startDateText,
						timeText: new_start_time,
						timezoneName: appTimezone
					});
					const updatedEnd = combineLocalDateAndTimeToUtcIso({
						dateValue: endDateText,
						timeText: new_end_time,
						timezoneName: appTimezone
					});

					if (updatedStart && updatedEnd) {
						await runSql(
							context.env.DB,
							'UPDATE tasks SET start_time=?, end_time=? WHERE id=?',
							[updatedStart, updatedEnd, taskId]
						);
					}
				}
			}

			// [PATCH] Update task_length in recurring_task_settings if new_start_time & new_end_time are provided
			if (!hasDurationUpdate && new_start_time && new_end_time) {
				const lengthMinutes = diffClockMinutes(new_start_time, new_end_time)

				if (lengthMinutes != null) {
					await runSql(
						context.env.DB,
						'UPDATE recurring_task_settings SET task_length=? WHERE id=?',
						[String(lengthMinutes), newRecId]
					);
				}
			}

			if (location_id) {
				await runSql(
					context.env.DB,
					'UPDATE tasks SET location_id=? WHERE id=?',
					[location_id, taskId]
				);
			}

		}

		// // [PATCH] Update details in recurring_task_settings if team_id, staff_id or task_team_members change
		// let detailsStr = "";
		// if (team_id || staff_id) {
		// 	if (team_id) {
		// 		let team = await getSql(context.env.DB, 'SELECT name FROM teams WHERE id=?', [team_id]);
				

		// 		detailsStr = team?.name ? team.name : "";
		// 	} else if (staff_id) {
		// 		let st = await getSql(context.env.DB, 'SELECT name, role FROM staff WHERE id=?', [staff_id]);
				

		// 		if (st) {
		// 			detailsStr = st.name + " (S)";
		// 		}
		// 	}

		// 	let memberNames = [];
		// 	if (Array.isArray(task_team_members)) {
		// 		for (const mid of task_team_members) {
		// 			let st = await getSql(context.env.DB, 'SELECT name, role FROM staff WHERE id=?', [mid]);
					

		// 			if (st) memberNames.push(st.name);
		// 		}
		// 	}

		// 	if (detailsStr && memberNames.length > 0) {
		// 		detailsStr = detailsStr + " - " + memberNames.join(", ");
		// 	} else if (!detailsStr) {
		// 		detailsStr = memberNames.join(", ");
		// 	}

		// 	await runSql(
		// 		context.env.DB,
		// 		'UPDATE recurring_task_settings SET details=? WHERE id=?',
		// 		[detailsStr, recId]
		// 	);
		// }


		return context.json({ ok: true, updated: tasks.length });
	} catch (e) {
		 // if (transactionStarted) {
		//   try {
		//     await runSql('ROLLBACK');
		//   } catch (rollbackErr) {
		//     console.error('rollback error', rollbackErr);
		//   }
		// }

		console.error('update recurring tasks error', e);
		return context.json({ error: e.message }, 500);
	}
});

app.post("/api/tasks/:id/recurring", authMiddleware, async context => {
	const taskId = context.req.param().id;
	const body = await context.req.json()
	const appTimezone = getRequestTimezone(context.req, context.env);

	const {
		frequency,
		selectedDays,
		occurrences,
		closeDate,
		startingDate,
		parent_task
	} = body;

	try {
		let task = await getSql(context.env.DB, 'SELECT * FROM tasks WHERE id = ?', [taskId]);
		// debugger;
		

		if (!task) return context.json({ error: 'Task not found' }, 404);

		const normalizedSelectedDays = normalizeRecurringWeekdays(selectedDays);
		let selectedDayRecurringTaskSettingRecIdMap = {};
		for (let selectedDay of normalizedSelectedDays) {
			// Save recurring settings before generating tasks
			let recId = uuidv4();
			// Compute finalCloseDate, taskLengthStr, detailsStr
			const finalCloseDate = closeDate
				? getUtcEndOfLocalDay(closeDate, appTimezone)
				: null;
			const taskLengthMinutes = diffMinutes(task.start_time, task.end_time) ?? 0
			const taskLengthStr = String(taskLengthMinutes);
			let detailsStr = "";
			if (task.team_id) {
				let team = await getSql(context.env.DB, 'SELECT name FROM teams WHERE id=?', [task.team_id]);
				

				detailsStr = team?.name ? team.name : "";
			}

			let originalMembers = await allSql(context.env.DB, 'SELECT staff_id FROM task_team_members WHERE task_id=?', [taskId]);
			originalMembers = originalMembers.results || [];
			
			const memberIds = originalMembers.map(m => m.staff_id);
			let nameParts = [];

			// debugger;
			// console.log('------------task--------');
			// console.log(task);
			// console.log('------------task--------');

			let supervisorStaffDetails = await getSql(context.env.DB, 'SELECT name FROM staff WHERE id=?', [task.staff_id]);

			if (supervisorStaffDetails && supervisorStaffDetails.name) {
				nameParts.push(supervisorStaffDetails.name + " (S)");
			}

			for (const sid of memberIds) {
				let st = await getSql(context.env.DB, 'SELECT name, role FROM staff WHERE id=?', [sid]);

				if (st) {
					nameParts.push(st.name);
				}
			}

			if (detailsStr) {
				detailsStr = detailsStr + " - " + nameParts.join(", ");
			} else {
				detailsStr = nameParts.join(", ");
			}


			await runSql(
				context.env.DB,
				`INSERT INTO recurring_task_settings
         (id, request_freq, monday, tuesday, wednesday, thrusday, friday, saturday, sunday,
          occurrences, close_date, parent_task, task_length, details)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
				[
					recId,
					frequency,
					selectedDay === 1 ? 1 : 0,
					selectedDay === 2 ? 1 : 0,
					selectedDay === 3 ? 1 : 0,
					selectedDay === 4 ? 1 : 0,
					selectedDay === 5 ? 1 : 0,
					selectedDay === 6 ? 1 : 0,
					selectedDay === 0 ? 1 : 0,
					occurrences || null,
					finalCloseDate,
					taskId,
					taskLengthStr,
					detailsStr
				]
			);

			selectedDayRecurringTaskSettingRecIdMap[selectedDay] = recId;
		}

		const recurringDates = generateRecurringDates({
			startingDate,
			selectedDays: normalizedSelectedDays,
			occurrences,
			closeDate,
			frequency,
			timezoneName: appTimezone
		});

		let results = [];
		let selectedDayLastTaskDateMap = {}
		const originalStartLocal = toZonedDateTime(task.start_time, appTimezone);
		const originalEndLocal = toZonedDateTime(task.end_time, appTimezone);
		const originalEndDayOffset = originalStartLocal && originalEndLocal
			? originalEndLocal.startOf('day').diff(originalStartLocal.startOf('day'), 'day')
			: 0;
		const originalStartTimeText = originalStartLocal?.format('HH:mm') || null;
		const originalEndTimeText = originalEndLocal?.format('HH:mm') || null;

		for (const nextDate of recurringDates) {
			const weekday = nextDate.day();
			const localDateText = nextDate.format('YYYY-MM-DD');
			const endDateText = nextDate.add(originalEndDayOffset, 'day').format('YYYY-MM-DD');
			const newStart = combineLocalDateAndTimeToUtcIso({
				dateValue: localDateText,
				timeText: originalStartTimeText,
				timezoneName: appTimezone
			});
			const newEnd = combineLocalDateAndTimeToUtcIso({
				dateValue: endDateText,
				timeText: originalEndTimeText,
				timezoneName: appTimezone
			});

			if (!newStart || !newEnd) {
				continue;
			}

			const newId = uuidv4();

			await runSql(
				context.env.DB,
				`INSERT INTO tasks
           (id, task_name, assignment_type, staff_id, team_id, client_id, location_id,
            start_time, end_time, publish, shift_instructions, color,
            isLocation,
            started_at, stopped_at, travel_from, travel_dist, travel_duration,
            payment_type, payment_amount, payment_date,
            task_client_name, task_client_company, task_client_email, task_client_phone,
            task_client_abn, task_client_acn, task_client_instruction,
            task_client_information, task_client_property_information, recurring_settings)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
				[
					newId,
					task.task_name,
					task.assignment_type,
					task.staff_id,
					task.team_id,
					task.client_id,
					task.location_id,
					newStart,
					newEnd,
					task.publish,
					task.shift_instructions,
					task.color,
					task.isLocation ?? 0,
					null,
					null,
					task.travel_from,
					task.travel_dist,
					task.travel_duration,
					task.payment_type,
					task.payment_amount,
					task.payment_date,
					task.task_client_name,
					task.task_client_company,
					task.task_client_email,
					task.task_client_phone,
					task.task_client_abn,
					task.task_client_acn,
					task.task_client_instruction,
					task.task_client_information,
					task.task_client_property_information,
					selectedDayRecurringTaskSettingRecIdMap[weekday]
				]
			);

			selectedDayLastTaskDateMap[weekday] = newEnd;

			let members = await allSql(
				context.env.DB,
				'SELECT staff_id FROM task_team_members WHERE task_id=?',
				[taskId]
			);

			members = members.results || [];

			for (const m of members) {
				await runSql(
					context.env.DB,
					'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?,?,?,?)',
					[uuidv4(), task.team_id, newId, m.staff_id]
				);
			}

			results.push({ id: newId, start_time: newStart, end_time: newEnd });
		}

		// After generating all tasks, set close date automatically if not provided
		if (!closeDate && results.length > 0) {
			for (const recKey of Object.keys(selectedDayRecurringTaskSettingRecIdMap)) {
				const rid = selectedDayRecurringTaskSettingRecIdMap[recKey];
				let lastTaskDateForCurrentWeekday = selectedDayLastTaskDateMap[recKey];
				await runSql(
					context.env.DB,
					'UPDATE recurring_task_settings SET close_date=? WHERE id=?',
					[lastTaskDateForCurrentWeekday, rid]
				);
			}
		}

		return context.json({ created: results.length, tasks: results });
	} catch (err) {
		console.error(err);
		return context.json({error: err.message}, 500);
	}
});


/* -----------------------------
   💬 Task Comments
----------------------------- */
app.get('/api/task_comments/:taskid', authMiddleware, async context => {
	try {
		let taskInstructions = await allSql(context.env.DB, 'SELECT * FROM task_comments WHERE task_id = ?', [context.req.param().taskid]);
		taskInstructions = taskInstructions.results || [];
		
		if (!taskInstructions) {
			return context.json({ error: 'taskInstructions not found' }, 404);
		}
		return context.json(taskInstructions);
	} catch (error) {
		return context.json({ error: error.message }, 500);
	}
});

app.post('/api/task_comments/bulk', authMiddleware, async c => {
	try {
		const body = await c.req.json()
		const { taskIds } = body

		if (!Array.isArray(taskIds) || taskIds.length === 0) {
			return c.json({ error: 'taskIds is required' }, 400)
		}

		const placeholders = taskIds.map(() => '?').join(',')
		const { results } = await c.env.DB
			.prepare(`SELECT * FROM task_comments WHERE task_id IN (${placeholders})`)
			.bind(...taskIds)
			.all()

		return c.json(results)
	} catch (e) {
		console.error('Bulk task_comments error', e)
		return c.json({ error: e.message }, 500)
	}
})

app.post('/api/task_comments', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const body = await context.req.json()
		const fields = ['task_id', 'comment', 'is_read', 'staff_id'];
		const values = fields.map(k => {
			if (k === 'is_read') {
				const v = body[k];
				if (v === true || v === 1 || v === '1') return 1;
				return 0;
			}
			return body[k] || null;
		});

		await runSql(
			context.env.DB,
			`INSERT INTO task_comments (${fields.join(',')}, id)
       VALUES (${fields.map(() => '?').join(',')}, ?)`,
			[...values, id]
		);

		let row = await getSql(context.env.DB, 'SELECT * FROM task_comments WHERE id=?', [id]);

		return context.json(row);
	} catch (error) {
		return context.json({ error: error.message }, 500);
	}
});

app.put('/api/task_comments/:id', authMiddleware, async context => {
	try {
		const fields = ['task_id', 'comment', 'is_read', 'staff_id'];
		const body = await context.req.json()

		const setClause = fields.map(f => `${f}=?`).join(', ');
		const values = fields.map(k => {
			if (k === 'is_read') {
				const v = body[k];
				if (v === true || v === 1 || v === '1') return 1;
				if (v === false || v === 0 || v === '0') return 0;
				return v == null ? 0 : 1;
			}
			return body[k] || null;
		});

		await runSql(context.env.DB, `UPDATE task_comments SET ${setClause} WHERE id=?`, [...values, context.req.param().id]);

		let row = await getSql(context.env.DB, 'SELECT * FROM task_comments WHERE id=?', [context.req.param().id]);
		

		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/**
 * Set is_read on a task comment (body: { isRead } or { is_read }, default mark read).
 */
app.patch('/api/task_comments/:id/read', authMiddleware, async context => {
	try {
		const id = context.req.param().id;
		let body = {};
		try {
			body = await context.req.json();
		} catch {
			body = {};
		}
		const raw = body.isRead !== undefined ? body.isRead : body.is_read;
		const isRead =
			raw === false || raw === 0 || raw === '0' || raw === 'false' ? 0 : 1;

		const existing = await getSql(context.env.DB, 'SELECT id FROM task_comments WHERE id = ?', [id]);
		if (!existing) {
			return context.json({ error: 'Task comment not found' }, 404);
		}

		await runSql(context.env.DB, 'UPDATE task_comments SET is_read = ? WHERE id = ?', [isRead, id]);
		const row = await getSql(context.env.DB, 'SELECT * FROM task_comments WHERE id = ?', [id]);
		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.delete('/api/task_comments/:id', authMiddleware, async context => {
	try {
		await runSql(context.env.DB, 'DELETE FROM task_comments WHERE id=?', [context.req.param().id]);
		return context.json({ ok: true });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

/* -----------------------------
   📋 Tasks Schedule
----------------------------- */
app.get('/api/taskschedule', authMiddleware, async context => {
	try {

		// console.log('req query', context.req.query());
		const { from, to, staffId, clientId } = context.req.query();
		const appTimezone = getRequestTimezone(context.req, context.env);

		let where = [];
		let params = [];
		const { fromUtc, toUtcExclusive } = buildUtcRangeFromLocalDates({
			from,
			to,
			timezoneName: appTimezone,
			inclusiveTo: true
		});

		if (fromUtc) {
			where.push('start_time >= ?');
			params.push(fromUtc);
		}
		if (toUtcExclusive) {
			where.push('start_time < ?');
			params.push(toUtcExclusive);
		}
		if (staffId) {
			where.push('tasks.staff_id = ?');
			params.push(staffId);
		}
		if (clientId) {
			where.push('tasks.client_id = ?');
			params.push(clientId);
		}

		const sql = `
      SELECT
        tasks.*,
        staff.name AS staff_name,
        clients.client_name AS client_name
      FROM tasks
      LEFT JOIN staff ON staff.id = tasks.staff_id
      LEFT JOIN clients ON clients.id = tasks.client_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY start_time ASC
    `;

		let rows = await allSql(context.env.DB, sql, params);
		rows = rows.results || [];

		const withDurations = rows.map((row) => {
			const scheduledMinutes = (row.start_time && row.end_time)
			  ? Math.max(0, Math.floor((new Date(row.end_time) - new Date(row.start_time)) / 60000))
			  : 0;
			const loggedMinutes = (row.started_at && row.stopped_at)
			  ? Math.max(0, Math.floor((new Date(row.stopped_at) - new Date(row.started_at)) / 60000))
			  : 0;
			const computedPayMinutes = computePayLengthMinutes({
				start_time: row.start_time,
				end_time: row.end_time,
				started_at: row.started_at,
				stopped_at: row.stopped_at
			}) ?? Math.min(scheduledMinutes, loggedMinutes)
			const storedPay = row.pay_length_minutes
			const payLengthMinutes = (storedPay != null && storedPay !== '' && Number.isFinite(Number(storedPay)))
			  ? Math.max(0, Math.round(Number(storedPay)))
			  : computedPayMinutes

			return {
				...row,
				// keep compatibility with report UI fields
				log_start_time: row.started_at || null,
				log_end_time: row.stopped_at || null,
				scheduled_length_minutes: scheduledMinutes,
				log_length_minutes: loggedMinutes,
				pay_length_minutes: payLengthMinutes
			};
		});

		return context.json(withDurations);
	} catch (e) {
		console.error('Task scehdule error', e);
		return context.json({ error: e.message }, 500);
	}
});

/* -----------------------------
   📋 Shifts by staff and week
----------------------------- */
app.get('/api/shifts/by-staff-week', authMiddleware, async context => {
	try {
		const { staffId, weekStart, weekEnd } = context.req.query();
		const appTimezone = getRequestTimezone(context.req, context.env);

		if (!staffId || !weekStart || !weekEnd) {
			return context.json(
				{ error: 'staffId, weekStart and weekEnd query params are required' },
				400
			);
		}

	// Below sql query will get all tasks for the staff if supervisor or cleaner
	// 	const sql = `
    //   SELECT t.*, s.name AS staff_name, c.client_name AS client_name, l.title AS location_title, tm.name AS team_supervisor,
    //   l.lat AS location_lat, l.lng AS location_lng, l.unit_no AS location_unit_no, l.radius_meters AS location_radius_meters, l.comment AS location_comment
    //   FROM tasks t
    //   LEFT JOIN staff s ON t.staff_id = s.id
    //   LEFT JOIN clients c ON t.client_id = c.id
    //   LEFT JOIN locations l ON t.location_id = l.id
    //   LEFT JOIN teams te ON t.team_id = te.id
    //   LEFT JOIN staff tm ON te.supervisor_id = tm.id
    //   WHERE (t.staff_id = ? OR t.id IN (SELECT task_id FROM task_team_members WHERE staff_id = ?))
    //     AND date(t.start_time) >= date(?)
    //     AND date(t.start_time) <= date(?)
	// 	AND t.publish = 1
    //   ORDER BY t.start_time ASC
    // `;

		const { fromUtc, toUtcExclusive } = buildUtcRangeFromLocalDates({
			from: weekStart,
			to: weekEnd,
			timezoneName: appTimezone,
			inclusiveTo: true
		});

		const sql = `
      SELECT t.*, s.name AS staff_name, c.client_name AS client_name, l.title AS location_title, tm.name AS team_supervisor,
      l.lat AS location_lat, l.lng AS location_lng, l.unit_no AS location_unit_no, l.radius_meters AS location_radius_meters, l.comment AS location_comment
      FROM tasks t
      LEFT JOIN staff s ON t.staff_id = s.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN locations l ON t.location_id = l.id
      LEFT JOIN teams te ON t.team_id = te.id
      LEFT JOIN staff tm ON te.supervisor_id = tm.id
      WHERE (t.staff_id = ?)
        AND t.start_time >= ?
        AND t.start_time < ?
		AND t.publish = 1
      ORDER BY t.start_time ASC
    `;

		// let rows = await allSql(context.env.DB, sql, [staffId, staffId, weekStart, weekEnd]);
		let rows = await allSql(context.env.DB, sql, [staffId, fromUtc, toUtcExclusive]);
		rows = rows.results || [];

		for (const task of rows) {
			let teamMembers = await allSql(context.env.DB, 'SELECT staff_id FROM task_team_members WHERE task_id = ?', [task.id]);
			teamMembers = teamMembers.results || [];
			task.task_team_members = teamMembers.map(tm => tm.staff_id);
		}

		return context.json({ data: rows });
	} catch (e) {
		console.error('Shifts by-staff-week error', e);
		return context.json({ error: e.message }, 500);
	}
});

/* -----------------------------
  🖼️ Staff Roster
----------------------------- */
app.get("/schedule/viewStaffRoster", async context => {

	const { url_id, key, key2 } = context.req.query();
	const appTimezone = getRequestTimezone(context.req, context.env);
  
	if (!url_id || !key || !key2) {
	  return context.text("Invalid URL", 400);
	}
  
	// Validate staff token
	const staff = await getSql(context.env.DB,`
		SELECT id, name
		FROM staff
		WHERE id = ?
		AND roster_token1 = ?
		AND roster_token2 = ?
	`,[url_id, key, key2]);

	// console.log(staff);
  
	if (!staff) {
		return context.text("Unauthorized", 403);
	}

	const { startUtc: currentWeekStartUtc, endUtcExclusive: nextWeekStartUtc } =
		getCurrentWeekUtcRange(appTimezone);
  
	// Get tasks for the current week (Monday-Sunday)
	const tasks = await allSql(context.env.DB, `
		WITH roster_staff AS (
			SELECT tm.task_id, tm.staff_id, s.name AS staff_name
			FROM task_team_members tm
			JOIN staff s ON s.id = tm.staff_id

			UNION

			SELECT t.id AS task_id, t.staff_id, s.name AS staff_name
			FROM tasks t
			JOIN staff s ON s.id = t.staff_id
			WHERE t.staff_id IS NOT NULL
		)
		SELECT 
			t.id,
			t.start_time,
			t.end_time,
			c.client_name,
			GROUP_CONCAT(
				CASE
					WHEN rs.staff_id = t.staff_id THEN rs.staff_name || ' (S)'
					ELSE rs.staff_name
				END,
				', '
			) AS staff_names
		FROM tasks t
		LEFT JOIN clients c ON c.id = t.client_id
		LEFT JOIN roster_staff rs ON rs.task_id = t.id
		WHERE (
				t.staff_id = ?
				OR t.id IN (
					SELECT task_id
					FROM task_team_members
					WHERE staff_id = ?
				)
			)
			AND t.start_time >= ?
			AND t.start_time < ?
		GROUP BY t.id
		ORDER BY t.start_time;
	`,[url_id, url_id, currentWeekStartUtc, nextWeekStartUtc]);
  
	const formatDate = (date) =>
		formatInTimezone(date, appTimezone, 'ddd, DD MMM YYYY h:mm A');
  
	let rows = "";

	// console.log('tasks')
	// console.log(tasks);
  
	tasks?.results?.forEach(t => {
  
	  rows += `
	  <div style="border-bottom: 2px solid lightgrey; padding: 10px;" class="row">
		<div class="col-sm-6">
		  ${formatDate(t.start_time)} ${t.staff_names}
		  <br>
		  <small> Finish Time: ${formatDate(t.end_time)}</small>
		</div>
	  </div>
	  `;
	});
  
	const html = `
  <html lang="en">
  <head>
  <title>Starr365.com</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
  
  <style>
  @media screen and (max-width: 800px) {
	#header { text-align: center; }
	h3 { text-align: center; }
  }
  </style>
  
  </head>
  
  <body>
  
  <div class="container">
  
  <div id="header" style="background:#eaeaea;padding:20px;margin-bottom:15px;">
  <div class="row">
  
  <div class="col-sm-4">
  <img src="${homemaidLogo}" style="height:80px;">
  </div>
  
  <div class="col-sm-8">
  <strong style="font-size:16px;font-weight:1000;">
  Home Maid Commercial & Residential Cleaning
  </strong>
  
  <p>7/249 Shellharbour Road, Port Kembla NSW 2505</p>
  <p>Email : admin@homemaid.com.au<br>
  Website : homemaid.com.au</p>
  
  </div>
  
  </div>
  </div>
  
  <h3>Roster</h3>
  
  ${rows}
  
  </div>
  
  </body>
  </html>
  `;
  
  return context.render(html);  
  });


/* -----------------------------
  Task Staff Travel CRUD
----------------------------- */
app.get('/api/task_staff_travel', authMiddleware, async context => {
	try {
		let rows = await allSql(
			context.env.DB,
			'SELECT * FROM task_staff_travel ORDER BY created_at DESC'
		);
		rows = rows.results || [];
		return context.json(rows);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.get('/api/task_staff_travel/task/:task_id', authMiddleware, async context => {
	try {
		let rows = await allSql(
			context.env.DB,
			'SELECT * FROM task_staff_travel WHERE task_id = ? ORDER BY created_at DESC',
			[context.req.param().task_id]
		);
		rows = rows.results || [];
		return context.json(rows);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.post('/api/task_staff_travel/bulk', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const { taskIds } = body;

		if (!Array.isArray(taskIds) || taskIds.length === 0) {
			return context.json({ error: 'taskIds is required' }, 400);
		}

		const placeholders = taskIds.map(() => '?').join(',');
		let rows = await allSql(
			context.env.DB,
			`SELECT * FROM task_staff_travel
			 WHERE task_id IN (${placeholders})
			 ORDER BY task_id, created_at DESC`,
			taskIds
		);

		rows = rows.results || [];
		return context.json(rows);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.put('/api/task_staff_travel/task/:task_id', authMiddleware, async context => {
	try {
		const taskId = context.req.param().task_id;
		const body = await context.req.json().catch(() => []);
		const rows = Array.isArray(body) ? body : body.task_staff_travel;

		if (!Array.isArray(rows)) {
			return context.json({ error: 'task_staff_travel array is required' }, 400);
		}

		await runSql(context.env.DB, 'DELETE FROM task_staff_travel WHERE task_id = ?', [taskId]);

		for (const row of rows) {
			if (!row?.staff_id) continue;

			await runSql(
				context.env.DB,
				`INSERT INTO task_staff_travel
				 (id, task_id, staff_id, travel_distance, travel_duration)
				 VALUES (?, ?, ?, ?, ?)`,
				[
					uuidv4(),
					taskId,
					row.staff_id,
					row.travel_distance ?? row.travel_dist ?? null,
					row.travel_duration ?? row.travel_time ?? null
				]
			);
		}

		let updatedRows = await allSql(
			context.env.DB,
			'SELECT * FROM task_staff_travel WHERE task_id = ? ORDER BY created_at DESC',
			[taskId]
		);
		updatedRows = updatedRows.results || [];
		return context.json(updatedRows);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.delete('/api/task_staff_travel/task/:task_id', authMiddleware, async context => {
	try {
		await runSql(
			context.env.DB,
			'DELETE FROM task_staff_travel WHERE task_id = ?',
			[context.req.param().task_id]
		);
		return context.json({ ok: true });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.get('/api/task_staff_travel/:id', authMiddleware, async context => {
	try {
		const row = await getSql(
			context.env.DB,
			'SELECT * FROM task_staff_travel WHERE id = ?',
			[context.req.param().id]
		);

		if (!row) {
			return context.json({ error: 'Task staff travel not found' }, 404);
		}

		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.post('/api/task_staff_travel', authMiddleware, async context => {
	try {
		const id = uuidv4();
		const body = await context.req.json();
		const { task_id, staff_id, travel_distance, travel_duration, travel_dist, travel_time } = body;

		await runSql(
			context.env.DB,
			`INSERT INTO task_staff_travel
			 (id, task_id, staff_id, travel_distance, travel_duration)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				id,
				task_id,
				staff_id,
				travel_distance ?? travel_dist ?? null,
				travel_duration ?? travel_time ?? null
			]
		);

		const row = await getSql(
			context.env.DB,
			'SELECT * FROM task_staff_travel WHERE id = ?',
			[id]
		);

		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.put('/api/task_staff_travel/:id', authMiddleware, async context => {
	try {
		const body = await context.req.json();
		const { task_id, staff_id, travel_distance, travel_duration, travel_dist, travel_time } = body;

		await runSql(
			context.env.DB,
			`UPDATE task_staff_travel
			 SET task_id = ?, staff_id = ?, travel_distance = ?, travel_duration = ?
			 WHERE id = ?`,
			[
				task_id,
				staff_id,
				travel_distance ?? travel_dist ?? null,
				travel_duration ?? travel_time ?? null,
				context.req.param().id
			]
		);

		const row = await getSql(
			context.env.DB,
			'SELECT * FROM task_staff_travel WHERE id = ?',
			[context.req.param().id]
		);

		if (!row) {
			return context.json({ error: 'Task staff travel not found' }, 404);
		}

		return context.json(row);
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});

app.delete('/api/task_staff_travel/:id', authMiddleware, async context => {
	try {
		await runSql(
			context.env.DB,
			'DELETE FROM task_staff_travel WHERE id = ?',
			[context.req.param().id]
		);
		return context.json({ ok: true });
	} catch (e) {
		return context.json({ error: e.message }, 500);
	}
});


/* -----------------------------
  🖼️ Generic
----------------------------- */
const genericCrud = (table, fields) => {
	app.get(`/api/${table}`, authMiddleware, async context => {
		try {
			let rows = await allSql(context.env.DB, `SELECT * FROM ${table}`);
			rows = rows.results || [];

			return context.json(rows);
		} catch (e) { return context.json({ error: e.message }, 500); }
	});

	app.post(`/api/${table}`, authMiddleware, async context => {
		try {
			const id = uuidv4();
			const body = await context.req.json();
			const values = fields.map(f => body[f] || null);
			await runSql(
				context.env.DB,
				`INSERT INTO ${table} (${fields.join(',')}, id) VALUES (${fields.map(() => '?').join(',')}, ?)`,
				[...values, id]
			);
			let row = await getSql(context.env.DB, `SELECT * FROM ${table} WHERE id=?`, [id]);
			
			return context.json(row);
		} catch (e) { return context.json({ error: e.message }, 500); }
	});

	app.put(`/api/${table}/:id`, authMiddleware, async context => {
		try {
			const body = await context.req.json();
			const setClause = fields.map(f => `${f}=?`).join(', ');
			const values = fields.map(f => body[f] || null);
			await runSql(context.env.DB, `UPDATE ${table} SET ${setClause} WHERE id=?`, [...values, context.req.param().id]);
			let row = await getSql(context.env.DB, `SELECT * FROM ${table} WHERE id=?`, [context.req.param().id]);
			

			return context.json(row);
		} catch (e) { return context.json({ error: e.message }, 500); }
	});

	app.delete(`/api/${table}/:id`, authMiddleware, async context => {
		try {
			await runSql(context.env.DB, `DELETE FROM ${table} WHERE id=?`, [context.req.param().id]);
			return context.json({ ok: true });
		} catch (e) { return context.json({ error: e.message }, 500); }
	});
};

// Initialize for smaller tables
// genericCrud('task_comments', ['task_id', 'comment', 'is_read', 'staff_id']);
// genericCrud('images', ['task_id', 'staff_id', 'images']);
// genericCrud('task_instructions', ['task_id', 'ques', 'resp_type', 'reply', 'replied_at']);
genericCrud('task_team_members', ['team_id', 'task_id', 'staff_id']);

// const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => {
//   console.log('Backend running on port', PORT);
// });

export default app;
