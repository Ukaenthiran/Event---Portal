// script.js

// ---------------------- Helper functions ----------------------
function getByIdSafe(id) {
    // Try getElementById first, otherwise use attribute selector (handles IDs with spaces)
    return document.getElementById(id) || document.querySelector(`[id="${id}"]`);
}
function getVal(id) {
    const el = getByIdSafe(id);
    return el ? el.value.trim() : "";
}
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const p = document.getElementById(pageId);
    if (p) p.classList.add('active');
}
function timeToMinutes(h, m, ampm) {
    h = parseInt(h, 10);
    m = parseInt(m, 10) || 0;
    if (isNaN(h)) h = 0;
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
}
function formatTime(h, m, ampm) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
    });
}

// ---------------------- Global state ----------------------
let tempEvent = {}; // holds form values across multi-step form

// ---------------------- Login (Staff / Student) ----------------------
const staffBtn = getByIdSafe('staff-btn');
const studentBtn = getByIdSafe('student-btn');
const loginBtn = getByIdSafe('login-btn');
const loginError = getByIdSafe('login-error');
let currentUserType = 'staff';

if (staffBtn && studentBtn) {
    staffBtn.addEventListener('click', () => {
        currentUserType = 'staff';
        staffBtn.classList.add('active');
        studentBtn.classList.remove('active');
    });
    studentBtn.addEventListener('click', () => {
        currentUserType = 'student';
        studentBtn.classList.add('active');
        staffBtn.classList.remove('active');
    });
}

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const password = (getByIdSafe('password')?.value || '').trim();
        if (currentUserType === 'staff' && password === 'prince2025') {
            loginError.textContent = '';
            showPage('staff-user-info-page');
        } else if (currentUserType === 'student' && password === 'psvasc2025') {
            loginError.textContent = '';
            showPage('student-calendar-page');
            loadCalendar(currentMonth, currentYear); // render calendar after login
        } else {
            if (loginError) loginError.textContent = 'Invalid password. Try again!';
        }
    });
}

// ---------------------- Staff multi-step navigation ----------------------
// Next from User Info -> Event Details
document.querySelectorAll('#staff-user-info-page .next-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Validate user info minimally
        const userName = getVal('user-name');
        const contact = getVal('contact-details');
        const email = getVal('email-id');
        const dept = getVal('Department'); // note: id is "Department"
        const designation = getVal('Designation');

        if (!userName) { alert('Enter user name'); return; }
        // we can do more validation if needed

        // Save into tempEvent
        tempEvent.organizerName = userName;
        tempEvent.contact = contact;
        tempEvent.email = email;
        tempEvent.organizerDepartment = dept;
        tempEvent.organizerDesignation = designation;

        showPage('staff-event-details-page');
    });
});

// Next from Event Details -> Resource Person (check slot conflict here)
document.querySelectorAll('#staff-event-details-page .next-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Read event detail fields (IDs with spaces handled)
        const eventTitle = getVal('event-title');
        const eventType = getVal('Event Type');       // id "Event Type"
        const eventVenue = getVal('Event Venue');     // id "Event Venue"
        const eventDate = getVal('event-date');

        const sh = getVal('start-hour');
        const sm = getVal('start-minute');
        const sampm = getVal('start-ampm');
        const eh = getVal('end-hour');
        const em = getVal('end-minute');
        const eampm = getVal('end-ampm');

        const targetDept = getVal('Target Department'); // id "Target Department"
        const audienceCount = getVal('audience-count');

        // Basic validation
        if (!eventTitle || !eventType || !eventVenue || !eventDate || !sh || !eh) {
            alert('Please fill required event details (title, type, venue, date and times).');
            return;
        }

        // Convert to minutes and validate ordering
        const startMin = timeToMinutes(sh, sm || 0, sampm || 'AM');
        const endMin = timeToMinutes(eh, em || 0, eampm || 'AM');
        if (endMin <= startMin) { alert('End time must be after start time.'); return; }

        // Check conflict against saved events in localStorage
        const savedEvents = JSON.parse(localStorage.getItem('events') || '[]');

        const conflict = savedEvents.some(ev => {
            if ((ev.venue || '').toLowerCase() !== eventVenue.toLowerCase()) return false;
            if (ev.date !== eventDate) return false;
            // ev should have startMin/endMin stored (we'll store them on submit). For compatibility, check possible property names:
            const existingStart = ev.startMin !== undefined ? ev.startMin : (ev.startTimeMinutes || 0);
            const existingEnd = ev.endMin !== undefined ? ev.endMin : (ev.endTimeMinutes || 0);
            // Overlap if start < existingEnd && end > existingStart
            return (startMin < existingEnd && endMin > existingStart);
        });

        if (conflict) {
            alert('Slot already booked for this venue at the selected date/time.');
            return;
        }

        // Save event details into tempEvent (do NOT persist to localStorage yet)
        tempEvent.eventTitle = eventTitle;
        tempEvent.eventType = eventType;
        tempEvent.venue = eventVenue;
        tempEvent.date = eventDate;
        tempEvent.startHour = sh; tempEvent.startMinute = sm || '00'; tempEvent.startAmpm = sampm || 'AM';
        tempEvent.endHour = eh; tempEvent.endMinute = em || '00'; tempEvent.endAmpm = eampm || 'AM';
        tempEvent.startMin = startMin;
        tempEvent.endMin = endMin;
        tempEvent.targetDepartment = targetDept;
        tempEvent.audienceCount = audienceCount;

        // Next page
        showPage('staff-resource-person-page');
    });
});

// ---------------------- Final Submit (Resource person + save) ----------------------
const submitBtn = getByIdSafe('submit-event-btn');
if (submitBtn) {
    submitBtn.addEventListener('click', async function (e) {
        e.preventDefault(); // prevent form submit navigation

        // Collect resource person details
        const rpName = getVal('resource-person-name');
        const rpDesig = getVal('resource-person-designation');
        const rpDept = getVal('resource-person-department');
        const rpCollege = getVal('resource-person-college');
        const rpExp = getVal('resource-person-experience');

        // Basic validation
        if (!rpName) { alert('Enter resource person name'); return; }

        // Files
        const photoInput = getByIdSafe('resource-person-photo');
        const profileInput = getByIdSafe('resource-person-profile');
        const photoFile = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
        const profileFile = profileInput && profileInput.files && profileInput.files[0] ? profileInput.files[0] : null;

        // Read files (if any) as dataURL
        let photoDataUrl = null;
        let profileDataUrl = null;
        try {
            photoDataUrl = await readFileAsDataURL(photoFile);
            profileDataUrl = await readFileAsDataURL(profileFile);
        } catch (err) {
            console.error('File read error', err);
            alert('Error reading uploaded files. Try again.');
            return;
        }

        // Merge resource person details into tempEvent
        tempEvent.resourcePersonName = rpName;
        tempEvent.resourcePersonDesignation = rpDesig;
        tempEvent.resourcePersonDepartment = rpDept;
        tempEvent.resourcePersonCollege = rpCollege;
        tempEvent.resourcePersonExperience = rpExp;
        tempEvent.resourcePersonPhoto = photoDataUrl; // base64 or null
        tempEvent.resourcePersonProfile = profileDataUrl; // base64 or null

        // Prepare event object to save
        const eventObj = {
            organizerName: tempEvent.organizerName || '',
            organizerContact: tempEvent.contact || '',
            organizerEmail: tempEvent.email || '',
            organizerDepartment: tempEvent.organizerDepartment || '',
            organizerDesignation: tempEvent.organizerDesignation || '',

            title: tempEvent.eventTitle || '',
            type: tempEvent.eventType || '',
            venue: tempEvent.venue || '',
            date: tempEvent.date || '',
            startHour: tempEvent.startHour || '',
            startMinute: tempEvent.startMinute || '',
            startAmpm: tempEvent.startAmpm || '',
            endHour: tempEvent.endHour || '',
            endMinute: tempEvent.endMinute || '',
            endAmpm: tempEvent.endAmpm || '',
            startTimeFormatted: formatTime(tempEvent.startHour || 0, tempEvent.startMinute || 0, tempEvent.startAmpm || 'AM'),
            endTimeFormatted: formatTime(tempEvent.endHour || 0, tempEvent.endMinute || 0, tempEvent.endAmpm || 'AM'),
            startMin: tempEvent.startMin,
            endMin: tempEvent.endMin,
            targetDepartment: tempEvent.targetDepartment || '',
            audienceCount: tempEvent.audienceCount || '',

            resourcePersonName: tempEvent.resourcePersonName || '',
            resourcePersonDesignation: tempEvent.resourcePersonDesignation || '',
            resourcePersonDepartment: tempEvent.resourcePersonDepartment || '',
            resourcePersonCollege: tempEvent.resourcePersonCollege || '',
            resourcePersonExperience: tempEvent.resourcePersonExperience || '',
            resourcePersonPhoto: tempEvent.resourcePersonPhoto || null,
            resourcePersonProfile: tempEvent.resourcePersonProfile || null,

            createdAt: new Date().toISOString()
        };

        // Final conflict-check again (race-safe) before saving
        const existing = JSON.parse(localStorage.getItem('events') || '[]');
        const conflict = existing.some(ev => {
            if ((ev.venue || '').toLowerCase() !== (eventObj.venue || '').toLowerCase()) return false;
            if (ev.date !== eventObj.date) return false;
            const s = ev.startMin !== undefined ? ev.startMin : (ev.startTimeMinutes || 0);
            const e = ev.endMin !== undefined ? ev.endMin : (ev.endTimeMinutes || 0);
            return (eventObj.startMin < e && eventObj.endMin > s);
        });
        if (conflict) {
            alert('Slot already booked (another booking was saved meanwhile). Choose another time.');
            return;
        }

        // Save
        existing.push(eventObj);
        localStorage.setItem('events', JSON.stringify(existing));

        // reset temp state and forms
        tempEvent = {};
        // Reset forms if they exist
        const f1 = getByIdSafe('user-info-form'); if (f1) f1.reset();
        const f2 = getByIdSafe('event-details-form'); if (f2) f2.reset();
        const f3 = getByIdSafe('resource-person-form'); if (f3) f3.reset();

        alert('Event submitted successfully.');
        showPage('login-page');
    });
}

// ---------------------- Student Calendar & Modal ----------------------
const monthYear = getByIdSafe('month-year');
const calendarDates = getByIdSafe('calendar-dates');
const prevMonthBtn = getByIdSafe('prev-month-btn');
const nextMonthBtn = getByIdSafe('next-month-btn');
const modal = getByIdSafe('event-modal');
const modalBody = getByIdSafe('modal-body');
const closeBtn = document.querySelector('.close-btn');

let now = new Date();
let currentMonth = now.getMonth();
let currentYear = now.getFullYear();

function getAllEvents() {
    const saved = JSON.parse(localStorage.getItem('events') || '[]');
    // Optionally include sample events here if you want. For now we'll only use saved events.
    return saved;
}

function loadCalendar(month, year) {
    if (!monthYear || !calendarDates) return;
    monthYear.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;
    calendarDates.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const allEvents = getAllEvents();

    // empty placeholders
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.classList.add('calendar-empty');
        calendarDates.appendChild(empty);
    }

    // days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');
        dayDiv.textContent = d;

        // find events for this day
        const eventsForDay = allEvents.filter(ev => ev.date === dateStr);
        if (eventsForDay.length > 0) {
            dayDiv.classList.add('event-day');
            dayDiv.addEventListener('click', () => showEventModal(dateStr));
        }
        calendarDates.appendChild(dayDiv);
    }
}

function showEventModal(date) {
    const all = getAllEvents();
    const eventsForDate = all.filter(ev => ev.date === date);
    if (!modalBody || !modal) return;

    if (eventsForDate.length === 0) {
        modalBody.innerHTML = `<p>No events for ${date}</p>`;
    } else {
        // If multiple events on same date, show them stacked
        modalBody.innerHTML = eventsForDate.map(ev => {
            const photoHTML = ev.resourcePersonPhoto ? `<img src="${ev.resourcePersonPhoto}" alt="photo" class="card-photo">` : '';
            const pdfLink = ev.resourcePersonProfile ? `<a href="${ev.resourcePersonProfile}" target="_blank">View PDF</a>` : 'No attachment';
            return `
                <div class="event-card-modal">
                    <div class="card-top">
                        <div class="card-title">Event on ${ev.date}</div>
                        ${photoHTML}
                    </div>
                    <div class="card-body">
                        <p><strong>Name:</strong> ${ev.title || ''}</p>
                        <p><strong>Type:</strong> ${ev.type || ''}</p>
                        <p><strong>Venue:</strong> ${ev.venue || ''}</p>
                        <p><strong>Check-in Time:</strong> ${ev.startTimeFormatted || formatTime(ev.startHour || 0, ev.startMinute || 0, ev.startAmpm || 'AM')}</p>
                        <p><strong>Department:</strong> ${ev.targetDepartment || ev.organizerDepartment || ''}</p>
                        <p><strong>Resource Person:</strong> ${ev.resourcePersonName || ''}</p>
                        <p><strong>Designation:</strong> ${ev.resourcePersonDesignation || ''}</p>
                        <p><strong>College:</strong> ${ev.resourcePersonCollege || ''}</p>
                        <p><strong>Experience:</strong> ${ev.resourcePersonExperience || ''}</p>
                        <p><strong>Attachment:</strong> ${pdfLink}</p>
                    </div>
                </div>
            `;
        }).join('<hr>');
    }

    modal.style.display = 'block';
}

// modal close handlers
if (closeBtn) {
    closeBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
}
window.addEventListener('click', (ev) => { if (ev.target === modal) modal.style.display = 'none'; });

// month navigation
if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        loadCalendar(currentMonth, currentYear);
    });
}
if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        loadCalendar(currentMonth, currentYear);
    });
}

// Initial calendar load if page is student calendar
loadCalendar(currentMonth, currentYear);

// ---------------------- End of script ----------------------
