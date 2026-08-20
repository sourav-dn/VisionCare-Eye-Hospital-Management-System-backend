# ?? VisionCare Backend API

> REST API + real-time WebSocket server for the VisionCare Eye Hospital Management System.
> Built with **Node.js**, **Express**, **MongoDB (Mongoose)**, and **Socket.IO**.

---

##  Project Structure

```
backend/
+-- config/
   +-- db.js                     # MongoDB connection (with DNS fallback)
+-- controllers/
   +-- auth.controller.js        # Login, register, profile, password
   +-- admin.controller.js       # Departments, doctors, rooms, staff
   +-- patient.controller.js     # Patient CRUD + search
   +-- visit.controller.js       # Ticket lifecycle, consultation, prescription
   +-- analytics.controller.js  # Dashboard analytics for admin
+-- middleware/
   +-- auth.middleware.js        # JWT protect guard
   +-- roleCheck.middleware.js   # Role-based access (admin/doctor/etc.)
   +-- errorHandler.middleware.js# Global error handler
+-- models/
   +-- User.model.js             # Staff + patient accounts
   +-- Patient.model.js          # Patient profile (demographics)
   +-- Visit.model.js            # Ticket / visit record
   +-- Department.model.js       # Hospital departments
   +-- Room.model.js             # Consultation rooms
+-- routes/
   +-- auth.routes.js
   +-- admin.routes.js
   +-- patient.routes.js
   +-- visit.routes.js
   +-- analytics.routes.js
+-- sockets/
   +-- socket.js                 # Socket.IO room management
+-- utils/
   +-- assignDoctor.js           # Auto doctor assignment algorithm
+-- uploads/
   +-- avatars/                  # User profile picture local storage
+-- seed.js                       # Database seeder (test data)
+-- server.js                     # App entry point
+-- .env                          # Environment variables
```

---

##  Environment Variables

Create a `.env` file in the `/backend` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/eye-hospital

# Authentication
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d

# Cloudinary (for prescription PDF attachments)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Hospital branding
HOSPITAL_NAME=VisionCare Eye Hospital
HOSPITAL_LOGO_URL=

# CORS origin (Vite dev server)
CLIENT_URL=http://localhost:5173
```

---

##  Getting Started

```bash
# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev

# Start production server
npm start

# Seed database with test data
npm run seed
```

Server runs at ? **http://localhost:5000**

---

##  Authentication

All protected routes require a **Bearer JWT token** in the Authorization header:

```
Authorization: Bearer <token>
```

### Roles

| Role | Description |
|---|---|
| `admin` | Full access  manages staff, rooms, departments, analytics |
| `receptionist` | Creates tickets, manages queue, hands off prescriptions |
| `doctor` | Views own queue, updates consultation notes, changes visit status |
| `patient` | Books appointments, views own visit history |

---

##  API Reference

Base URL: `http://localhost:5000/api`

---

###  Auth  `/api/auth`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/register-patient` | Public | Patient self-registration |
| `POST` | `/register-staff` | Admin | Create doctor/receptionist/admin account |
| `POST` | `/login` | Public | Login for all roles  returns JWT |
| `GET`  | `/me` | Protected | Get current logged-in user |
| `PUT`  | `/profile` | Protected | Update name, phone, avatar |
| `PUT`  | `/change-password` | Protected | Change own password |

#### POST /api/auth/register-patient
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "phone": "01711000001",
  "age": 30,
  "gender": "male",
  "address": "Dhaka, Bangladesh"
}
```

<!-- #### POST /api/auth/login
```json
{ "email": "admin@visioncare.com", "password": "Admin@123" }
```
Response:
```json
{
  "success": true,
  "token": "<jwt>",
  "user": { "_id": "...", "name": "...", "role": "admin" }
}
``` -->

#### PUT /api/auth/profile
```json
{
  "name": "New Name",
  "phone": "01711000099",
  "avatarBase64": "data:image/jpeg;base64,..."
}
```
> Avatar saved to `uploads/avatars/user_{id}_{timestamp}.{ext}`  served at `/uploads/avatars/`.

---

###  Admin  `/api/admin`  (admin only)

#### Departments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/departments` | List all departments |
| `POST`   | `/departments` | Create department |
| `PUT`    | `/departments/:id` | Update department |
| `DELETE` | `/departments/:id` | Delete department |

#### Doctors
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/doctors` | List all doctors |
| `GET`    | `/doctors/:id` | Get single doctor |
| `POST`   | `/doctors` | Create doctor account |
| `PUT`    | `/doctors/:id` | Update doctor info |
| `PATCH`  | `/doctors/:id/toggle-availability` | Toggle available/unavailable |
| `DELETE` | `/doctors/:id` | Deactivate doctor account |

#### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/rooms` | List all rooms |
| `POST`   | `/rooms` | Create room |
| `PUT`    | `/rooms/:id` | Update room |
| `DELETE` | `/rooms/:id` | Delete room |
| `PATCH`  | `/rooms/:id/assign` | Assign/unassign doctor `{ doctorId: "..." or null }` |

#### Staff
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/staff` | List all staff |
| `POST` | `/staff` | Create staff account |
| `PUT`  | `/staff/:id` | Update staff info |

---

###  Patients  `/api/patients`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET`  | `/my-history` | Patient | Own visits + profile |
| `GET`  | `/search?q=...` | Admin/Reception/Doctor | Search by name or phone |
| `GET`  | `/` | Admin/Reception/Doctor | All patients |
| `POST` | `/` | Admin/Reception | Create patient |
| `GET`  | `/:id` | Admin/Reception/Doctor | Patient by ID |
| `PUT`  | `/:id` | Admin/Reception | Update patient |

---

###  Visits  `/api/visits`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET`  | `/today/stats` | Admin/Reception | Today's queue counts |
| `POST` | `/` | Admin/Reception/Patient | Create ticket |
| `GET`  | `/` | All roles | Visits (filtered per role) |
| `GET`  | `/:id` | All roles | Single visit |
| `PATCH`| `/:id/status` | Admin/Reception/Doctor | Change status |
| `PATCH`| `/:id/consultation` | Admin/Doctor | Save consultation notes |
| `PATCH`| `/:id/assign-doctor` | Admin/Reception | Reassign doctor |
| `GET`  | `/:id/prescription` | All roles | Get prescription PDF |

#### Visit Status Flow
```
scheduled > waiting > in-consultation > in-procedure > ready-for-prescription > completed
                                                                                  >
                                                                              cancelled
```

#### POST /api/visits  Create Ticket
```json
{
  "patientId": "<ObjectId>",
  "departmentId": "<ObjectId>",
  "chiefComplaint": "Blurred vision",
  "bookingType": "walk-in"
}
```
> Doctor is **auto-assigned** to the least-busy available doctor in the department.

#### PATCH /api/visits/:id/consultation
```json
{
  "diagnosis": "Myopia",
  "doctorNotes": "Needs corrective lenses",
  "medicines": [
    {
      "name": "Ciprofloxacin Eye Drops",
      "dosage": "0.3%",
      "duration": "7 days",
      "timing": "1 drop 4x/day",
      "notes": "Avoid contact lenses"
    }
  ],
  "testsAdvised": [{ "name": "Visual Acuity Test", "result": "" }],
  "nextVisitDate": "2026-09-01"
}
```

---

###  Analytics  `/api/analytics`  (admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/overview` | Total visits, patients, doctors summary |
| `GET` | `/doctor-load` | Patient count per doctor |
| `GET` | `/department-stats` | Visit count per department |
| `GET` | `/room-utilization` | Room occupancy stats |
| `GET` | `/visit-trend` | Daily visit trend (last 30 days) |

---

###  Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/departments` | Active departments |
| `GET` | `/api/departments/:id/doctors` | Available doctors in a department |
| `GET` | `/api/public/doctors` | All doctors with department + room |
| `GET` | `/api/health` | API health check |

---

###  Static Files

| Path | Description |
|------|-------------|
| `/uploads/avatars/:filename` | User profile pictures |

---

##  Data Models

### User
```
_id, name, email, password (hashed), role, department (ref),
phone, avatar (path), isAvailable, isActive,
patientProfile (ref), createdAt, updatedAt
```

### Patient
```
_id, patientId (P-XXXXX), name, phone, age, gender,
address, bloodGroup, allergies[], medicalHistory[],
userAccount (ref User), createdAt, updatedAt
```

### Visit
```
_id, ticketNumber (VC-YYYYMMDD-XXXX),
patient (ref), department (ref), assignedDoctor (ref),
roomNumber, bookingType, status, priority,
chiefComplaint, diagnosis, doctorNotes,
medicines[], testsAdvised[], nextVisitDate,
appointmentDate, prescriptionUrl,
finalizedBy (ref), finalizedAt, statusHistory[],
createdAt, updatedAt
```

### Department
```
_id, name, description, isActive
```

### Room
```
_id, roomNumber, floor, roomType, assignedDoctor (ref), status
```

---

##  Socket.IO Events

### Client Server (join rooms)
| Event | Payload | Description |
|---|---|---|
| `join-doctor-room` | `doctorId` | Doctor joins personal queue room |
| `join-receptionist` |  | Receptionist joins global room |
| `join-waiting-room` |  | Waiting display screen connects |
| `toggle-availability` | `{ doctorId, isAvailable }` | Doctor broadcasts status |
| `ping` |  | Heartbeat  server responds `pong` |

### Server Client (real-time updates)
| Event | Target | Trigger |
|---|---|---|
| `new-ticket-assigned` | `doctor-{id}` | New ticket assigned to this doctor |
| `queue-update` | `receptionist` | Any visit status change |
| `doctor-availability-changed` | `receptionist` | Doctor toggles availability |
| `pong` | sender | Response to `ping` |

---

<!-- ##  Database Seeding

```bash
npm run seed
```

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@visioncare.com | Admin@123 |
| Receptionist | reception@visioncare.com | Recept@123 |
| Doctor | arjun@visioncare.com | Doctor@123 |
| Doctor | priya@visioncare.com | Doctor@123 |

Test patient phones: `01711000001`, `01711000002`, `01711000003`

--- -->

##  Security

- Passwords hashed with **bcrypt** (12 salt rounds)
- JWT  stateless, verified on every protected request
- `helmet`  secure HTTP headers
- `cors`  restricted to `CLIENT_URL`
- Role-based access enforced at route + controller level
- Passwords excluded from all queries via `select: false`

---

##  Key Design Decisions

| Decision | Reason |
|---|---|
| Auto doctor assignment | Picks least-busy available doctor  reduces receptionist workload |
| Ticket number `VC-YYYYMMDD-XXXX` | Human-readable, date-scoped, unique per day |
| `statusHistory[]` array | Every change is timestamped  enables analytics + audit trail |
| Local avatar storage | Profile pictures in `uploads/avatars/`  no cloud service dependency |
| DNS fallback in `db.js` | Switches to Google/Cloudflare DNS if local DNS fails Atlas SRV lookup |
| Role-filtered `GET /visits` | Doctors see only their patients; patients only their own  no data leaks |
