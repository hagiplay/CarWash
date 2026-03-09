// ==================== הגדרות ברירת מחדל ====================
const DEFAULT_SETTINGS = {
    workingHours: {
        sunday: { enabled: true, start: '08:00', end: '18:00' },
        monday: { enabled: true, start: '08:00', end: '18:00' },
        tuesday: { enabled: true, start: '08:00', end: '18:00' },
        wednesday: { enabled: true, start: '08:00', end: '18:00' },
        thursday: { enabled: true, start: '08:00', end: '18:00' },
        friday: { enabled: true, start: '08:00', end: '16:00' },
        saturday: { enabled: false, start: '00:00', end: '00:00' } // שבת תמיד חסום
    },
    serviceDuration: 45, // דקות
    gapBetweenServices: 15, // דקות
    bookingHorizon: 30, // ימים
    minLeadTime: 60, // דקות
    adminPassword: 'noam2024',
    businessAddress: 'קטיף 14 הושעיה (שלב ז׳)',
    businessPhone: '0586614800'
};

// ==================== כלים עזרים ====================
class Utils {
    static formatDate(date) {
        return new Intl.DateTimeFormat('he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            timeZone: 'Asia/Jerusalem'
        }).format(date);
    }

    static formatTime(date) {
        return new Intl.DateTimeFormat('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jerusalem'
        }).format(date);
    }

    static isValidPhone(phone) {
        const phoneRegex = /^05[0-9]-?[0-9]{7}$|^05[0-9][0-9]{7}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    static isValidName(name) {
        return name && name.trim().length >= 2;
    }

    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// ==================== ספק אחסון נתונים (API-based) ====================
class StorageProvider {
    constructor() {
        this._bookings = [];
        this._settings = null;
        this._blockedDates = [];
        this._heldSlotsKey = 'carwash_held_slots';
    }

    // טעינת כל הנתונים מהשרת בפעם אחת
    async init() {
        const [settingsRes, bookingsRes, blockedRes] = await Promise.all([
            fetch('/api/settings'),
            fetch('/api/bookings'),
            fetch('/api/blocked-dates')
        ]);

        const settingsData = await settingsRes.json();
        const bookingsData = await bookingsRes.json();
        const blockedData = await blockedRes.json();

        this._settings = settingsData.settings || DEFAULT_SETTINGS;
        this._bookings = bookingsData.bookings || [];
        this._blockedDates = blockedData.dates || [];
    }

    // ==================== הגדרות ====================
    getSettings() {
        return this._settings || DEFAULT_SETTINGS;
    }

    async saveSettings(settings) {
        this._settings = settings;
        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
        });
    }

    // ==================== הזמנות ====================
    getBookings() {
        return this._bookings;
    }

    async saveBooking(booking) {
        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(booking)
        });
        if (!res.ok) throw new Error('Failed to save booking');
        this._bookings.push(booking);
    }

    async deleteBooking(bookingId) {
        const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete booking');
        this._bookings = this._bookings.filter(b => b.id !== bookingId);
    }

    // ==================== תאריכים חסומים ====================
    getBlockedDates() {
        return this._blockedDates;
    }

    async saveBlockedDate(dateString) {
        await fetch('/api/blocked-dates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateString })
        });
        if (!this._blockedDates.includes(dateString)) {
            this._blockedDates.push(dateString);
        }
    }

    async removeBlockedDate(dateString) {
        await fetch(`/api/blocked-dates/${encodeURIComponent(dateString)}`, { method: 'DELETE' });
        this._blockedDates = this._blockedDates.filter(d => d !== dateString);
    }

    // ==================== החזקת slots (נשאר ב-localStorage - מצב UX זמני) ====================
    getHeldSlots() {
        const stored = localStorage.getItem(this._heldSlotsKey);
        const held = stored ? JSON.parse(stored) : {};

        const now = Date.now();
        const cleanHeld = {};
        for (const [key, value] of Object.entries(held)) {
            if (now - value.timestamp < 120000) {
                cleanHeld[key] = value;
            }
        }

        if (Object.keys(cleanHeld).length !== Object.keys(held).length) {
            localStorage.setItem(this._heldSlotsKey, JSON.stringify(cleanHeld));
        }

        return cleanHeld;
    }

    holdSlot(dateTime, sessionId) {
        const held = this.getHeldSlots();
        const key = dateTime.toISOString();
        held[key] = { sessionId, timestamp: Date.now() };
        localStorage.setItem(this._heldSlotsKey, JSON.stringify(held));
    }

    releaseSlot(dateTime, sessionId) {
        const held = this.getHeldSlots();
        const key = dateTime.toISOString();
        if (held[key] && held[key].sessionId === sessionId) {
            delete held[key];
            localStorage.setItem(this._heldSlotsKey, JSON.stringify(held));
        }
    }

    isSlotFree(dateTime, sessionId = null) {
        const bookings = this.getBookings();
        const held = this.getHeldSlots();
        const key = dateTime.toISOString();
        const settings = this.getSettings();

        const hasBooking = bookings.some(booking => {
            const bookingStart = new Date(booking.dateTime);
            const bookingEnd = new Date(bookingStart.getTime() + (settings.serviceDuration * 60000));
            const slotEnd = new Date(dateTime.getTime() + (settings.serviceDuration * 60000));
            return (dateTime < bookingEnd && slotEnd > bookingStart);
        });

        if (hasBooking) return false;

        const heldSlot = held[key];
        if (heldSlot && heldSlot.sessionId !== sessionId) {
            return false;
        }

        return true;
    }
}

// ==================== מתזמן תורים ====================
class Scheduler {
    constructor(storageProvider) {
        this.storage = storageProvider;
        this.settings = this.storage.getSettings();
    }

    generateSlots(date) {
        const slots = [];
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const workingHours = this.settings.workingHours[dayOfWeek];

        if (dayOfWeek === 'saturday' || !workingHours.enabled) {
            return slots;
        }

        const dateString = date.toISOString().split('T')[0];
        const blockedDates = this.storage.getBlockedDates();
        if (blockedDates.includes(dateString)) {
            return slots;
        }

        const startTime = this.parseTime(workingHours.start);
        const endTime = this.parseTime(workingHours.end);

        for (let minutes = startTime; minutes < endTime; minutes += 15) {
            const slotDate = new Date(date);
            slotDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

            const serviceEndMinutes = minutes + this.settings.serviceDuration + this.settings.gapBetweenServices;
            if (serviceEndMinutes <= endTime) {
                const now = new Date();
                const minBookingTime = new Date(now.getTime() + (this.settings.minLeadTime * 60000));

                if (slotDate >= minBookingTime) {
                    slots.push(slotDate);
                }
            }
        }

        return slots;
    }

    parseTime(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    getAvailableSlots(date, sessionId = null) {
        const allSlots = this.generateSlots(date);
        return allSlots.filter(slot => this.storage.isSlotFree(slot, sessionId));
    }

    isValidBookingDate(date) {
        const now = new Date();
        const maxDate = new Date(now.getTime() + (this.settings.bookingHorizon * 24 * 60 * 60 * 1000));
        return date >= now && date <= maxDate && date.getDay() !== 6;
    }
}

// ==================== יוצר קבצי ICS ====================
class ICSGenerator {
    static createEvent(booking, settings) {
        const startDate = new Date(booking.dateTime);
        const endDate = new Date(startDate.getTime() + (settings.serviceDuration * 60000));

        const formatDateTime = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//שטיפת הרכבים של נעם//NONSGML Event//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${booking.id}@carwash-noam.local`,
            `DTSTART:${formatDateTime(startDate)}`,
            `DTEND:${formatDateTime(endDate)}`,
            `SUMMARY:שטיפת רכב - ${booking.customerName}`,
            `DESCRIPTION:שטיפת רכב אצל נעם\\nטלפון: ${booking.customerPhone}\\nכתובת: ${settings.businessAddress}`,
            `LOCATION:${settings.businessAddress}`,
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        return icsContent;
    }

    static downloadICS(booking, settings) {
        const icsContent = this.createEvent(booking, settings);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `car-wash-${booking.id}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }
}

// ==================== מנהל ממשק משתמש ====================
class UIManager {
    constructor() {
        this.storage = new StorageProvider();
        this.scheduler = new Scheduler(this.storage);
        this.currentView = 'booking';
        this.selectedDate = null;
        this.selectedTime = null;
        this.sessionId = Utils.generateId();
        this.currentBooking = null;
        this.currentMonth = new Date();
        this.isAdmin = false;
        this.heldSlotTimeout = null;
    }

    // אתחול אסינכרוני - נקרא לאחר init של storage
    async initialize() {
        await this.storage.init();
        this.scheduler.settings = this.storage.getSettings();
        this.setupEventListeners();
        this.updateCalendar();

        // הצג את ממשק ההזמנות
        document.querySelector('.booking-section').style.display = 'block';
        document.querySelector('.loading').classList.remove('active');
    }

    setupEventListeners() {
        // ניווט ראשי
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        // לוח שנה
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.updateCalendar();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.updateCalendar();
        });

        // חזרה מבחירת שעה
        document.getElementById('back-to-calendar').addEventListener('click', () => {
            this.releaseHeldSlot();
            this.showCalendarView();
        });

        // טופס לקוח
        document.getElementById('customer-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitBooking();
        });

        document.getElementById('cancel-booking').addEventListener('click', () => {
            this.releaseHeldSlot();
            this.showCalendarView();
        });

        // הודעת הצלחה
        document.getElementById('download-ics').addEventListener('click', () => {
            if (this.currentBooking) {
                ICSGenerator.downloadICS(this.currentBooking, this.storage.getSettings());
            }
        });

        document.getElementById('new-booking').addEventListener('click', () => {
            this.resetBookingFlow();
        });

        // מנהל
        document.getElementById('admin-login-btn').addEventListener('click', () => {
            this.adminLogin();
        });

        // מקשי קיצור
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscape();
            }
        });

        // חיפוש הזמנות
        const searchInput = document.getElementById('search-bookings');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.filterBookings();
            }, 300));
        }
    }

    switchSection(section) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        document.querySelector('.booking-section').style.display = section === 'booking' ? 'block' : 'none';
        document.querySelector('.admin-panel').style.display = section === 'admin' ? 'block' : 'none';

        if (section === 'admin' && !this.isAdmin) {
            document.querySelector('.admin-login').style.display = 'block';
            document.querySelector('.admin-content').style.display = 'none';
        } else if (section === 'admin' && this.isAdmin) {
            document.querySelector('.admin-login').style.display = 'none';
            document.querySelector('.admin-content').style.display = 'block';
            this.loadAdminData();
        }

        this.currentView = section;
    }

    updateCalendar() {
        const calendarGrid = document.getElementById('calendar-grid');
        const calendarTitle = document.getElementById('calendar-title');

        calendarTitle.textContent = new Intl.DateTimeFormat('he-IL', {
            year: 'numeric',
            month: 'long',
            timeZone: 'Asia/Jerusalem'
        }).format(this.currentMonth);

        calendarGrid.innerHTML = '';

        const dayHeaders = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
        dayHeaders.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day-header';
            dayElement.textContent = day;
            calendarGrid.appendChild(dayElement);
        });

        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = currentDate.getDate();
            dayElement.setAttribute('data-date', currentDate.toISOString().split('T')[0]);

            if (currentDate.getMonth() !== this.currentMonth.getMonth()) {
                dayElement.classList.add('other-month');
            }

            if (currentDate.getDay() === 6) {
                dayElement.classList.add('saturday');
            } else if (this.scheduler.isValidBookingDate(currentDate)) {
                const availableSlots = this.scheduler.getAvailableSlots(currentDate);
                if (availableSlots.length === 0) {
                    dayElement.classList.add('disabled');
                } else {
                    dayElement.addEventListener('click', () => {
                        this.selectDate(currentDate);
                    });
                }
            } else {
                dayElement.classList.add('disabled');
            }

            calendarGrid.appendChild(dayElement);
        }
    }

    selectDate(date) {
        this.selectedDate = date;

        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        document.querySelector(`[data-date="${date.toISOString().split('T')[0]}"]`).classList.add('selected');

        this.showTimeSelection();
    }

    showTimeSelection() {
        document.getElementById('calendar-view').classList.remove('active');
        document.getElementById('time-view').classList.add('active');
        document.getElementById('selected-date-title').textContent =
            `בחר שעה עבור ${Utils.formatDate(this.selectedDate)}`;

        this.updateTimeSlots();
    }

    updateTimeSlots() {
        const timeSlotsContainer = document.getElementById('time-slots');
        timeSlotsContainer.innerHTML = '';

        const availableSlots = this.scheduler.getAvailableSlots(this.selectedDate, this.sessionId);
        const heldSlots = this.storage.getHeldSlots();

        availableSlots.forEach(slot => {
            const slotElement = document.createElement('button');
            slotElement.className = 'time-slot';
            slotElement.textContent = Utils.formatTime(slot);

            const slotKey = slot.toISOString();
            const heldSlot = heldSlots[slotKey];

            if (heldSlot && heldSlot.sessionId !== this.sessionId) {
                slotElement.classList.add('held');
                slotElement.disabled = true;
                slotElement.title = 'השעה מוחזקת על ידי משתמש אחר';
            } else {
                slotElement.addEventListener('click', () => {
                    this.selectTime(slot, slotElement);
                });
            }

            timeSlotsContainer.appendChild(slotElement);
        });

        if (availableSlots.length === 0) {
            timeSlotsContainer.innerHTML = '<p>אין שעות פנויות ביום זה</p>';
        }
    }

    selectTime(time, targetElement) {
        this.selectedTime = time;

        this.storage.holdSlot(time, this.sessionId);
        this.startHeldSlotTimer();

        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        if (targetElement) targetElement.classList.add('selected');

        this.showBookingForm();
    }

    startHeldSlotTimer() {
        if (this.heldSlotTimeout) {
            clearTimeout(this.heldSlotTimeout);
        }

        this.heldSlotTimeout = setTimeout(() => {
            this.releaseHeldSlot();
            Utils.showNotification('הזמן לאישור התור הסתיים. אנא בחר שעה מחדש.', 'warning');
            this.showTimeSelection();
        }, 120000);
    }

    releaseHeldSlot() {
        if (this.selectedTime) {
            this.storage.releaseSlot(this.selectedTime, this.sessionId);
        }
        if (this.heldSlotTimeout) {
            clearTimeout(this.heldSlotTimeout);
            this.heldSlotTimeout = null;
        }
    }

    showBookingForm() {
        document.getElementById('time-view').classList.remove('active');
        document.getElementById('booking-form').classList.add('active');

        this.updateBookingSummary();

        document.getElementById('customer-name').value = '';
        document.getElementById('customer-phone').value = '';
        this.clearFormErrors();
    }

    updateBookingSummary() {
        const summaryContainer = document.getElementById('booking-summary');
        const settings = this.storage.getSettings();
        const endTime = new Date(this.selectedTime.getTime() + (settings.serviceDuration * 60000));

        summaryContainer.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">תאריך:</span>
                <span class="detail-value">${Utils.formatDate(this.selectedDate)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">שעת התחלה:</span>
                <span class="detail-value">${Utils.formatTime(this.selectedTime)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">שעת סיום:</span>
                <span class="detail-value">${Utils.formatTime(endTime)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">כתובת:</span>
                <span class="detail-value">${settings.businessAddress}</span>
            </div>
        `;
    }

    async submitBooking() {
        const name = document.getElementById('customer-name').value.trim();
        const phone = document.getElementById('customer-phone').value.trim();

        if (!this.validateForm(name, phone)) {
            return;
        }

        if (!this.storage.isSlotFree(this.selectedTime, this.sessionId)) {
            Utils.showNotification('השעה שנבחרה כבר תפוסה. אנא בחר שעה אחרת.', 'error');
            this.showTimeSelection();
            return;
        }

        const booking = {
            id: Utils.generateId(),
            dateTime: this.selectedTime.toISOString(),
            customerName: name,
            customerPhone: phone,
            createdAt: new Date().toISOString(),
            status: 'confirmed'
        };

        try {
            await this.storage.saveBooking(booking);
            this.currentBooking = booking;
            this.releaseHeldSlot();
            Utils.showNotification('התור נקבע בהצלחה!', 'success');
            this.showSuccessMessage();
        } catch {
            Utils.showNotification('שגיאה בשמירת התור. אנא נסה שוב.', 'error');
        }
    }

    validateForm(name, phone) {
        let isValid = true;
        this.clearFormErrors();

        if (!Utils.isValidName(name)) {
            this.showFieldError('name-error', 'אנא הכנס שם פרטי תקין');
            isValid = false;
        }

        if (!Utils.isValidPhone(phone)) {
            this.showFieldError('phone-error', 'אנא הכנס מספר טלפון נייד תקין');
            isValid = false;
        }

        return isValid;
    }

    showFieldError(errorId, message) {
        const errorElement = document.getElementById(errorId);
        errorElement.textContent = message;
        errorElement.parentElement.classList.add('error');
    }

    clearFormErrors() {
        document.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
        });
        document.querySelectorAll('.error-message').forEach(error => {
            error.textContent = '';
        });
    }

    showSuccessMessage() {
        document.getElementById('booking-form').classList.remove('active');
        document.getElementById('success-message').classList.add('active');

        const detailsContainer = document.getElementById('success-details');
        const settings = this.storage.getSettings();
        const endTime = new Date(this.currentBooking.dateTime);
        endTime.setMinutes(endTime.getMinutes() + settings.serviceDuration);

        detailsContainer.innerHTML = `
            <p><strong>שם:</strong> ${this.currentBooking.customerName}</p>
            <p><strong>תאריך:</strong> ${Utils.formatDate(new Date(this.currentBooking.dateTime))}</p>
            <p><strong>שעה:</strong> ${Utils.formatTime(new Date(this.currentBooking.dateTime))} - ${Utils.formatTime(endTime)}</p>
            <p><strong>כתובת:</strong> ${settings.businessAddress}</p>
        `;

        const wazeLink = document.getElementById('waze-link');
        wazeLink.href = `https://waze.com/ul?q=${encodeURIComponent(settings.businessAddress)}&navigate=yes`;
    }

    showCalendarView() {
        document.getElementById('time-view').classList.remove('active');
        document.getElementById('booking-form').classList.remove('active');
        document.getElementById('success-message').classList.remove('active');
        document.getElementById('calendar-view').classList.add('active');

        this.selectedDate = null;
        this.selectedTime = null;
        this.currentBooking = null;
    }

    resetBookingFlow() {
        this.showCalendarView();
        this.updateCalendar();
    }

    handleEscape() {
        if (document.getElementById('booking-form').classList.contains('active')) {
            this.releaseHeldSlot();
            this.showTimeSelection();
        } else if (document.getElementById('time-view').classList.contains('active')) {
            this.showCalendarView();
        } else if (document.getElementById('success-message').classList.contains('active')) {
            this.resetBookingFlow();
        }
    }

    // ==================== ממשק מנהל ====================
    adminLogin() {
        const password = document.getElementById('admin-password').value;
        const settings = this.storage.getSettings();

        if (password === settings.adminPassword) {
            this.isAdmin = true;
            document.querySelector('.admin-login').style.display = 'none';
            document.querySelector('.admin-content').style.display = 'block';
            this.setupAdminInterface();
            this.loadAdminData();
            Utils.showNotification('ברוך הבא למנהל המערכת', 'success');
        } else {
            Utils.showNotification('סיסמה שגויה', 'error');
        }
    }

    setupAdminInterface() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchAdminTab(e.target.dataset.tab);
            });
        });

        document.getElementById('save-hours').addEventListener('click', () => {
            this.saveWorkingHours();
        });

        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveGeneralSettings();
        });

        document.getElementById('add-block').addEventListener('click', () => {
            this.addBlockedDate();
        });

        document.getElementById('export-csv').addEventListener('click', () => {
            this.exportBookingsCSV();
        });
    }

    switchAdminTab(tab) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));

        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.querySelector(`[data-section="${tab}"]`).classList.add('active');

        if (tab === 'bookings') {
            this.loadBookingsTable();
        }
    }

    loadAdminData() {
        this.loadWorkingHoursSettings();
        this.loadGeneralSettings();
        this.loadBlockedDates();
        this.loadBookingsTable();
    }

    loadWorkingHoursSettings() {
        const settings = this.storage.getSettings();
        const container = document.getElementById('working-hours');
        container.innerHTML = '';

        const dayNames = {
            sunday: 'ראשון',
            monday: 'שני',
            tuesday: 'שלישי',
            wednesday: 'רביעי',
            thursday: 'חמישי',
            friday: 'שישי',
            saturday: 'שבת (חסום)'
        };

        Object.entries(settings.workingHours).forEach(([day, hours]) => {
            const dayElement = document.createElement('div');
            dayElement.className = 'day-hours';

            const isShabbat = day === 'saturday';

            dayElement.innerHTML = `
                <label>${dayNames[day]}</label>
                <input type="time" data-day="${day}" data-field="start"
                       value="${hours.start}" ${isShabbat ? 'disabled' : ''}>
                <input type="time" data-day="${day}" data-field="end"
                       value="${hours.end}" ${isShabbat ? 'disabled' : ''}>
                <input type="checkbox" data-day="${day}"
                       ${hours.enabled ? 'checked' : ''} ${isShabbat ? 'disabled' : ''}>
            `;

            container.appendChild(dayElement);
        });
    }

    async saveWorkingHours() {
        const settings = this.storage.getSettings();

        document.querySelectorAll('.day-hours').forEach(dayElement => {
            const day = dayElement.querySelector('input[type="time"]').dataset.day;
            if (day !== 'saturday') {
                const start = dayElement.querySelector('[data-field="start"]').value;
                const end = dayElement.querySelector('[data-field="end"]').value;
                const enabled = dayElement.querySelector('input[type="checkbox"]').checked;

                settings.workingHours[day] = { start, end, enabled };
            }
        });

        try {
            await this.storage.saveSettings(settings);
            this.scheduler = new Scheduler(this.storage);
            Utils.showNotification('שעות הפעילות נשמרו בהצלחה', 'success');
        } catch {
            Utils.showNotification('שגיאה בשמירת ההגדרות', 'error');
        }
    }

    loadGeneralSettings() {
        const settings = this.storage.getSettings();
        document.getElementById('booking-horizon').value = settings.bookingHorizon;
        document.getElementById('min-lead-time').value = settings.minLeadTime;
    }

    async saveGeneralSettings() {
        const settings = this.storage.getSettings();
        settings.bookingHorizon = parseInt(document.getElementById('booking-horizon').value);
        settings.minLeadTime = parseInt(document.getElementById('min-lead-time').value);

        try {
            await this.storage.saveSettings(settings);
            this.scheduler = new Scheduler(this.storage);
            Utils.showNotification('ההגדרות נשמרו בהצלחה', 'success');
        } catch {
            Utils.showNotification('שגיאה בשמירת ההגדרות', 'error');
        }
    }

    loadBlockedDates() {
        const blockedDates = this.storage.getBlockedDates();
        const container = document.getElementById('blocked-dates');
        container.innerHTML = '';

        blockedDates.forEach(dateString => {
            const dateElement = document.createElement('div');
            dateElement.innerHTML = `
                <span>${new Date(dateString).toLocaleDateString('he-IL')}</span>
                <button class="table-btn" onclick="uiManager.removeBlockedDate('${dateString}')">הסר</button>
            `;
            container.appendChild(dateElement);
        });
    }

    async addBlockedDate() {
        const dateInput = document.getElementById('block-date');
        const dateString = dateInput.value;

        if (dateString) {
            try {
                await this.storage.saveBlockedDate(dateString);
                this.loadBlockedDates();
                dateInput.value = '';
                Utils.showNotification('התאריך נחסם בהצלחה', 'success');
            } catch {
                Utils.showNotification('שגיאה בחסימת התאריך', 'error');
            }
        }
    }

    async removeBlockedDate(dateString) {
        try {
            await this.storage.removeBlockedDate(dateString);
            this.loadBlockedDates();
            Utils.showNotification('החסימה הוסרה', 'success');
        } catch {
            Utils.showNotification('שגיאה בהסרת החסימה', 'error');
        }
    }

    loadBookingsTable() {
        const bookings = this.storage.getBookings();
        const tbody = document.querySelector('#bookings-table tbody');
        tbody.innerHTML = '';

        bookings
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
            .forEach(booking => {
                const row = document.createElement('tr');
                const bookingDate = new Date(booking.dateTime);

                row.innerHTML = `
                    <td>${bookingDate.toLocaleDateString('he-IL')}</td>
                    <td>${Utils.formatTime(bookingDate)}</td>
                    <td>${booking.customerName}</td>
                    <td>${booking.customerPhone}</td>
                    <td class="table-actions">
                        <button class="table-btn" onclick="uiManager.deleteBooking('${booking.id}')">
                            ביטול
                        </button>
                    </td>
                `;

                tbody.appendChild(row);
            });
    }

    async deleteBooking(bookingId) {
        if (confirm('האם אתה בטוח שברצונך לבטל את ההזמנה?')) {
            try {
                await this.storage.deleteBooking(bookingId);
                this.loadBookingsTable();
                Utils.showNotification('ההזמנה בוטלה בהצלחה', 'success');
            } catch {
                Utils.showNotification('שגיאה בביטול ההזמנה', 'error');
            }
        }
    }

    filterBookings() {
        const searchTerm = document.getElementById('search-bookings').value.toLowerCase();
        const rows = document.querySelectorAll('#bookings-table tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    exportBookingsCSV() {
        const bookings = this.storage.getBookings();
        const headers = ['תאריך', 'שעה', 'שם', 'טלפון', 'נוצר ב'];

        const csvContent = [
            headers.join(','),
            ...bookings.map(booking => {
                const bookingDate = new Date(booking.dateTime);
                const createdDate = new Date(booking.createdAt);
                return [
                    bookingDate.toLocaleDateString('he-IL'),
                    Utils.formatTime(bookingDate),
                    booking.customerName,
                    booking.customerPhone,
                    createdDate.toLocaleDateString('he-IL')
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `car-wash-bookings-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }
}

// ==================== התחלת האפליקציה ====================
let uiManager;

async function initApp() {
    document.querySelector('.loading').classList.add('active');
    uiManager = new UIManager();
    await uiManager.initialize();
}

// תמיכה הן בטעינה ראשונה הן ב-Next.js hydration
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// עדכון זמינות בזמן אמת
setInterval(() => {
    if (uiManager && uiManager.currentView === 'booking' &&
        document.getElementById('time-view') &&
        document.getElementById('time-view').classList.contains('active')) {
        uiManager.updateTimeSlots();
    }
}, 30000);
