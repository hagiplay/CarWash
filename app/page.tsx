import Script from 'next/script'

export default function Home() {
  return (
    <>
      <div className="container">
        {/* כותרת ראשית */}
        <header className="header">
          <h1>שטיפת הרכבים של נעם</h1>
          <p className="subtitle">זימון תורים מהיר ונוח</p>
          <p className="phone">📞 0586614800</p>
        </header>

        {/* כפתורי ניווט */}
        <nav className="nav-buttons">
          <button className="nav-btn active" data-section="booking" aria-label="זימון תור חדש">
            🚗 זימון תור
          </button>
          <button className="nav-btn" data-section="admin" aria-label="כניסה לאזור מנהל">
            ⚙️ ניהול
          </button>
        </nav>

        {/* תוכן ראשי */}
        <main className="main-content">
          {/* הודעת טעינה */}
          <div className="loading active">
            <div className="spinner"></div>
            <p>טוען נתונים...</p>
          </div>

          {/* זימון תורים */}
          <section className="booking-section" style={{ display: 'none' }}>
            {/* בחירת תאריך */}
            <div id="calendar-view" className="calendar-container active">
              <div className="calendar-header">
                <button className="calendar-nav" id="prev-month" aria-label="חודש קודם">‹</button>
                <h2 className="calendar-title" id="calendar-title"></h2>
                <button className="calendar-nav" id="next-month" aria-label="חודש הבא">›</button>
              </div>
              <div className="calendar-grid" id="calendar-grid"></div>
            </div>

            {/* בחירת שעה */}
            <div id="time-view" className="time-selection">
              <h3 id="selected-date-title"></h3>
              <div className="time-slots" id="time-slots"></div>
              <button className="back-btn" id="back-to-calendar">חזרה לבחירת תאריך</button>
            </div>

            {/* טופס הזמנה */}
            <div id="booking-form" className="booking-form">
              <div className="booking-summary">
                <h3>סיכום התור</h3>
                <div className="booking-details" id="booking-summary"></div>
              </div>

              <form id="customer-form">
                <div className="form-group">
                  <label htmlFor="customer-name">שם פרטי *</label>
                  <input type="text" id="customer-name" required aria-describedby="name-error" />
                  <div className="error-message" id="name-error"></div>
                </div>

                <div className="form-group">
                  <label htmlFor="customer-phone">טלפון נייד *</label>
                  <input type="tel" id="customer-phone" required aria-describedby="phone-error" placeholder="05X-XXXXXXX" />
                  <div className="error-message" id="phone-error"></div>
                </div>

                <div className="form-buttons">
                  <button type="submit" className="btn btn-primary">אשר תור</button>
                  <button type="button" className="btn btn-secondary" id="cancel-booking">ביטול</button>
                </div>
              </form>
            </div>

            {/* הודעת הצלחה */}
            <div id="success-message" className="success-message">
              <div className="success-icon">✅</div>
              <h2>התור נקבע בהצלחה!</h2>
              <div id="success-details"></div>
              <div className="action-buttons">
                <button className="action-btn" id="download-ics">הוסף ליומן</button>
                <a href="#" className="action-btn waze" id="waze-link" target="_blank" rel="noreferrer">ניווט ב-Waze</a>
                <button className="action-btn" id="new-booking">תור חדש</button>
              </div>
            </div>
          </section>

          {/* ממשק מנהל */}
          <section className="admin-panel" style={{ display: 'none' }}>
            {/* התחברות מנהל */}
            <div className="admin-login">
              <h2>כניסה לאזור מנהל</h2>
              <div className="form-group">
                <label htmlFor="admin-password">סיסמה</label>
                <input type="password" id="admin-password" placeholder="הכנס סיסמה" />
              </div>
              <button className="btn btn-primary" id="admin-login-btn">כניסה</button>
            </div>

            {/* תוכן מנהל */}
            <div className="admin-content">
              <div className="admin-tabs">
                <button className="admin-tab active" data-tab="settings">הגדרות</button>
                <button className="admin-tab" data-tab="bookings">הזמנות</button>
                <button className="admin-tab" data-tab="calendar">יומן</button>
                <button className="admin-tab" data-tab="reports">דוחות</button>
              </div>

              {/* הגדרות */}
              <div className="admin-section active" data-section="settings">
                <div className="settings-grid">
                  <div className="setting-group">
                    <h4>שעות פעילות</h4>
                    <div id="working-hours"></div>
                    <button className="btn btn-primary" id="save-hours">שמור שעות</button>
                  </div>

                  <div className="setting-group">
                    <h4>הגדרות כלליות</h4>
                    <div className="form-group">
                      <label htmlFor="booking-horizon">ימים להזמנה מראש</label>
                      <input type="number" id="booking-horizon" min="1" max="90" defaultValue="30" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="min-lead-time">זמן מינימום להזמנה (דקות)</label>
                      <input type="number" id="min-lead-time" min="0" defaultValue="60" />
                    </div>
                    <button className="btn btn-primary" id="save-settings">שמור הגדרות</button>
                  </div>
                </div>

                <div className="setting-group">
                  <h4>חסימות מיוחדות</h4>
                  <div className="form-group">
                    <label htmlFor="block-date">תאריך לחסימה</label>
                    <input type="date" id="block-date" />
                    <button className="btn btn-primary" id="add-block">הוסף חסימה</button>
                  </div>
                  <div id="blocked-dates"></div>
                </div>
              </div>

              {/* הזמנות */}
              <div className="admin-section" data-section="bookings">
                <div className="form-group">
                  <label htmlFor="search-bookings">חיפוש הזמנות</label>
                  <input type="text" id="search-bookings" placeholder="חפש לפי שם או טלפון" />
                </div>
                <table className="data-table" id="bookings-table">
                  <thead>
                    <tr>
                      <th>תאריך</th>
                      <th>שעה</th>
                      <th>שם</th>
                      <th>טלפון</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>

              {/* יומן */}
              <div className="admin-section" data-section="calendar">
                <h3>יומן הזמנות</h3>
                <div id="admin-calendar"></div>
              </div>

              {/* דוחות */}
              <div className="admin-section" data-section="reports">
                <h3>דוחות</h3>
                <button className="btn btn-primary" id="export-csv">יצוא לקובץ CSV</button>
                <div id="stats"></div>
              </div>
            </div>
          </section>
        </main>

        {/* פוטר */}
        <footer className="footer">
          <p>נעם בן משה, קטיף 14 שלב ז׳ הושעיה</p>
          <p>© 2024 שטיפת הרכבים של נעם - כל הזכויות שמורות</p>
        </footer>
      </div>

      {/* הודעות מערכת */}
      <div className="notification" id="notification"></div>

      <Script src="/carwash.js" strategy="afterInteractive" />
    </>
  )
}
