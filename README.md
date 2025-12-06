# Doctor Panel - MediConnect

## 📱 Overview

The Doctor Panel is a React Native mobile application built with Expo that allows doctors to manage appointments, view patient records, create e-prescriptions, and manage their settings. The app follows a modern, private hospital aesthetic with the "MediConnect" branding.

## 🏗️ Architecture

### Tech Stack
- **Framework**: React Native (Expo)
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **State Management**: Redux Toolkit
- **Storage**: AsyncStorage
- **UI Components**: React Native core components
- **Styling**: StyleSheet API
- **Notifications**: React Native Toast Message

### Project Structure
```
doctor/
├── App.tsx                    # Root component with navigation setup
├── src/
│   ├── screens/              # Main screen components
│   │   ├── AuthScreen.tsx    # Login screen
│   │   ├── DoctorTabs.tsx    # Bottom tab navigator
│   │   ├── AppointmentsScreen.tsx
│   │   ├── PatientRecordsScreen.tsx
│   │   ├── PrescriptionScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── DoctorDashboardScreen.tsx
│   ├── components/           # Reusable components
│   │   ├── DoctorNavbar.tsx
│   │   ├── TabIcon.tsx
│   │   ├── DatePicker.tsx
│   │   └── TimePicker.tsx
│   ├── store/               # Redux store
│   │   ├── store.ts
│   │   ├── authSlice.ts
│   │   └── hooks.ts
│   └── utils/               # Helper functions
│       ├── helpers.ts
│       ├── navigation.ts
│       └── storage.ts
```

## 🔄 Application Flow

### 1. **Authentication Flow**

```
App Launch
    ↓
Check AsyncStorage for saved auth
    ↓
┌─────────────────┐
│  AuthScreen      │ ← Login with email/password
└─────────────────┘
    ↓ (on success)
Save token & user to AsyncStorage
    ↓
Navigate to DoctorTabs
```

**Key Components:**
- `AuthScreen.tsx`: Handles doctor login
- `authSlice.ts`: Manages authentication state
- `storage.ts`: Handles AsyncStorage operations

**API Endpoint:**
- `POST /api/users/login` - Authenticates doctor

---

### 2. **Main Navigation Structure**

```
DoctorTabs (Bottom Tab Navigator)
    ├── 📅 Appointments Tab
    ├── 👥 Patients Tab
    ├── 💊 E-Prescriptions Tab
    └── ⚙️ Settings Tab
```

**Navigation Features:**
- Bottom tab bar with 4 main sections
- Custom tab icons with active/inactive states
- Top navbar (DoctorNavbar) showing current screen title
- User info display (Dr. [Name])

---

### 3. **Appointments Screen Flow**

```
AppointmentsScreen
    ↓
Auto-refresh on focus (useFocusEffect)
    ↓
Polling every 5 seconds (useEffect)
    ↓
Fetch appointments from API
    ↓
┌─────────────────────────────────┐
│  Tab Navigation:                │
│  • PENDING (with count)         │
│  • CONFIRMED (with count)       │
│  • CANCELLED (with count)       │
└─────────────────────────────────┘
    ↓
Display filtered appointments
    ↓
┌─────────────────────────────────┐
│  Actions Available:             │
│  • Accept (PENDING → CONFIRMED)  │
│  • Reschedule (PENDING/CONFIRMED)│
│  • Cancel (with reason)        │
│  • View Patient History (CANCELLED)│
└─────────────────────────────────┘
```

**Key Features:**
- **Real-time Updates**: Auto-refreshes every 5 seconds
- **Tab-based Filtering**: Separate views for PENDING, CONFIRMED, CANCELLED
- **Patient History Modal**: Shows past prescriptions and medical records for cancelled appointments
- **Smart Polling**: Pauses when modals are open

**API Endpoints:**
- `GET /api/appointments?doctorId={id}` - Fetch appointments
- `PATCH /api/appointments/{id}/status` - Update status (ACCEPT)
- `PATCH /api/appointments/{id}/reschedule` - Reschedule appointment
- `PATCH /api/appointments/{id}/cancel` - Cancel appointment
- `GET /api/prescriptions?patientId={id}` - Get patient prescriptions
- `GET /api/patient-records/{id}` - Get patient medical records

**State Management:**
- Local state for appointments list
- Redux for authentication
- AsyncStorage for preferences

---

### 4. **Patient Records Screen Flow**

```
PatientRecordsScreen
    ↓
┌─────────────────────────────────┐
│  Search/View Options:           │
│  • Search by Patient ID          │
│  • View Recent Patients          │
└─────────────────────────────────┘
    ↓
Display Patient Medical Record
    ↓
┌─────────────────────────────────┐
│  Record Sections:                │
│  • Diagnosis                     │
│  • Allergies                     │
│  • Current Medications           │
│  • Past Surgeries               │
│  • Hospitalization History       │
│  • Lab Reports                  │
│  • Clinical Notes               │
└─────────────────────────────────┘
    ↓
Edit/Add functionality for each section
```

**Key Features:**
- Search patients by ID
- View recent patients (from PENDING/CONFIRMED appointments only)
- Comprehensive medical record display
- Add/edit medical information

**API Endpoints:**
- `GET /api/patient-records/{patientId}` - Get patient record
- `PUT /api/patient-records/{patientId}` - Update patient record
- `GET /api/appointments?doctorId={id}` - Get recent patients

---

### 5. **E-Prescription Screen Flow**

```
PrescriptionScreen
    ↓
┌─────────────────────────────────┐
│  Step 1: Select Appointment      │
│  • Modal with patient list       │
│  • Shows patient name & reason   │
└─────────────────────────────────┘
    ↓ (after selection)
┌─────────────────────────────────┐
│  Step 2: Add Medicines           │
│  • Voice Input (optional)        │
│  • Manual Entry                  │
│  • Medicine details:             │
│    - Name, Dosage, Frequency,    │
│      Duration, Notes            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Step 3: Review Prescription    │
│  • List of all medicines         │
│  • Remove/edit items             │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Step 4: Submit                 │
│  • Send to Pharmacy             │
│  • Success modal                │
└─────────────────────────────────┘
```

**Key Features:**
- Conditional rendering: Only shows input sections after appointment selection
- Voice input using Web Speech API
- Manual medicine entry with validation
- Prescription list with remove functionality
- Success confirmation modal

**API Endpoints:**
- `GET /api/appointments?doctorId={id}` - Get appointments for selection
- `POST /api/prescriptions` - Create prescription

**Voice Input:**
- Uses `webkitSpeechRecognition` (Web Speech API)
- Converts speech to text
- Parses medicine information

---

### 6. **Settings Screen Flow**

```
SettingsScreen
    ↓
┌─────────────────────────────────┐
│  Profile Section:               │
│  • Doctor name & email           │
│  • Edit Profile modal            │
│  • Change Password modal         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Preferences Section:           │
│  • Notifications toggle         │
│  • Auto-refresh toggle          │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Support Section:               │
│  • Help Center modal            │
│  • Contact Support modal         │
│  • Privacy Policy modal          │
│  • About                        │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Account Actions:               │
│  • Logout                       │
└─────────────────────────────────┘
```

**Key Features:**
- Profile management
- Preference toggles (stored in AsyncStorage)
- Support modals with information
- Logout functionality

**Storage:**
- Preferences saved to AsyncStorage
- Auto-refresh preference affects polling behavior

---

## 🔌 API Integration

### Base URL
- Default: `http://localhost:4000`
- Configurable via `EXPO_PUBLIC_API_BASE` environment variable

### Authentication
- All API calls include `Authorization: Bearer {token}` header
- Token stored in Redux state and AsyncStorage
- Auto-logout on 401 responses

### Key API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users/login` | POST | Doctor authentication |
| `/api/appointments?doctorId={id}` | GET | Fetch doctor's appointments |
| `/api/appointments/{id}/status` | PATCH | Update appointment status |
| `/api/appointments/{id}/reschedule` | PATCH | Reschedule appointment |
| `/api/appointments/{id}/cancel` | PATCH | Cancel appointment |
| `/api/prescriptions` | POST | Create prescription |
| `/api/prescriptions?patientId={id}` | GET | Get patient prescriptions |
| `/api/patient-records/{id}` | GET | Get patient medical record |
| `/api/patient-records/{id}` | PUT | Update patient record |
| `/api/users/{id}` | GET | Get user details (for patient names) |

---

## 🎨 UI/UX Design

### Design System
- **Brand**: MediConnect (Private Hospital)
- **Primary Color**: `#0066CC` (Blue)
- **Success Color**: `#22c55e` (Green)
- **Warning Color**: `#f59e0b` (Orange)
- **Error Color**: `#ef4444` (Red)

### Component Patterns
- **Cards**: White background with subtle shadows
- **Modals**: Centered with backdrop
- **Buttons**: Rounded corners with shadows
- **Tabs**: Bottom navigation with icons
- **Forms**: Clean input fields with labels

### Responsive Design
- Adapts to different screen sizes
- ScrollView for long content
- Modal-based interactions for forms

---

## 🔄 State Management

### Redux Store Structure
```typescript
{
  auth: {
    token: string | null,
    user: {
      id: string,
      name: string,
      email: string,
      role: "DOCTOR",
      hospitalId: string
    },
    isAuthenticated: boolean,
    isLoading: boolean
  }
}
```

### Local State
- Screen-specific state managed with `useState`
- Form state (inputs, modals, loading)
- Data fetching state (appointments, patients, etc.)

### AsyncStorage
- Authentication tokens
- User data
- Preferences (auto-refresh, notifications)

---

## 🚀 Key Features

### 1. Real-time Updates
- **Auto-refresh**: Polls every 5 seconds for new appointments
- **Focus Refresh**: Refreshes when screen comes into focus
- **Smart Polling**: Pauses when modals are open

### 2. Appointment Management
- **Status-based Tabs**: PENDING, CONFIRMED, CANCELLED
- **Quick Actions**: Accept, Reschedule, Cancel
- **Patient History**: View past prescriptions for cancelled appointments
- **Count Badges**: Shows number of appointments per status

### 3. Patient Records
- **Search Functionality**: Find patients by ID
- **Recent Patients**: Quick access to recent appointments
- **Comprehensive Records**: Diagnosis, allergies, medications, etc.
- **Edit Capabilities**: Add/update medical information

### 4. E-Prescriptions
- **Voice Input**: Speech-to-text for medicine entry
- **Manual Entry**: Form-based medicine addition
- **Validation**: Ensures all required fields are filled
- **Pharmacy Integration**: Sends prescriptions to pharmacy system

### 5. Settings & Preferences
- **Profile Management**: Edit doctor profile
- **Password Change**: Secure password update
- **Preferences**: Toggle notifications and auto-refresh
- **Support**: Help center, contact support, privacy policy

---

## 📱 Navigation Flow Diagram

```
App.tsx
  ├── AuthScreen (if not authenticated)
  │     └── Login → Navigate to DoctorTabs
  │
  └── DoctorTabs (if authenticated)
        ├── DoctorNavbar (top bar)
        │
        └── Bottom Tabs
              ├── Appointments
              │     ├── PENDING Tab
              │     ├── CONFIRMED Tab
              │     └── CANCELLED Tab
              │           └── View Patient History Modal
              │
              ├── Patients
              │     ├── Search Patient
              │     └── View/Edit Medical Record
              │
              ├── E-Prescriptions
              │     ├── Select Appointment Modal
              │     ├── Voice Input Section
              │     ├── Manual Entry Section
              │     └── Submit Prescription
              │
              └── Settings
                    ├── Profile Section
                    ├── Preferences Section
                    ├── Support Section
                    └── Logout
```

---

## 🔐 Security Features

1. **Authentication**
   - JWT token-based authentication
   - Token stored securely in AsyncStorage
   - Auto-logout on token expiration

2. **Role Validation**
   - Only users with `role: "DOCTOR"` can access
   - Backend validates role on all endpoints

3. **Data Protection**
   - All API calls include authentication headers
   - Sensitive data not logged in console

---

## 🐛 Error Handling

### Network Errors
- Toast notifications for API failures
- Graceful degradation (shows cached data if available)
- Retry mechanisms for failed requests

### Validation Errors
- Form validation before submission
- Clear error messages
- User-friendly error toasts

### State Errors
- Try-catch blocks around async operations
- Fallback values for missing data
- Loading states during operations

---

## 📦 Dependencies

### Core
- `react-native`: Mobile framework
- `expo`: Development platform
- `@react-navigation/native`: Navigation
- `@react-navigation/bottom-tabs`: Tab navigation
- `@react-navigation/native-stack`: Stack navigation

### State Management
- `@reduxjs/toolkit`: Redux toolkit
- `react-redux`: React bindings for Redux

### Storage
- `@react-native-async-storage/async-storage`: Local storage

### UI/UX
- `react-native-toast-message`: Toast notifications

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v14+)
- npm or yarn
- Expo CLI
- Backend server running on port 4000

### Installation
```bash
cd mobileapp-Doctor/doctor
npm install
```

### Environment Setup
Create `.env` file:
```
EXPO_PUBLIC_API_BASE=http://localhost:4000
```

### Run Development Server
```bash
npm start
# or
expo start
```

### Build
```bash
# Android
expo build:android

# iOS
expo build:ios
```

---

## 📝 Notes

- The app uses polling for real-time updates (every 5 seconds)
- Patient names are fetched separately and cached in component state
- Modals pause polling to prevent unnecessary API calls
- All date/time formatting uses helper functions from `utils/helpers.ts`
- The app follows a modern, private hospital aesthetic (not government branding)

---

## 🔄 Data Flow Summary

1. **User logs in** → Token saved → Navigate to tabs
2. **Appointments screen loads** → Fetch appointments → Display in tabs
3. **New appointment created (by patient)** → Polling detects it → Auto-refresh
4. **Doctor accepts appointment** → Status updated → Tab switches to CONFIRMED
5. **Doctor creates prescription** → Select appointment → Add medicines → Submit
6. **Doctor views patient history** → Fetch prescriptions & records → Display in modal
7. **Doctor logs out** → Clear storage → Navigate to Auth screen

---

## 🎯 Future Enhancements

- Push notifications for new appointments
- Offline mode with sync
- Image uploads for prescriptions
- Video consultation integration
- Advanced search and filters
- Analytics dashboard
- Export prescriptions as PDF

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintained By**: MediConnect Development Team

