import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen';

// ==========================================
// 1. HEADER / NAVBAR COMPONENT
// ==========================================
function Navbar({ activeTab, setActiveTab, username, onSignOut }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'reviews', label: 'Reviews Queue' },
    { id: 'action', label: 'Action Desk' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <header style={styles.navbar}>
      <div style={styles.navContainer}>
        <div style={styles.brand}>
          <div style={styles.logoIcon}>H</div>
          <div>
            <h1 style={styles.brandTitle}>
              HotelFeedback <span style={styles.badgeAi}>AI</span>
            </h1>
            <p style={styles.brandSubtitle}>Guest Intelligence Platform</p>
          </div>
        </div>
        <nav style={styles.navLinks}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navButton,
                ...(activeTab === tab.id ? styles.navButtonActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
          <span style={styles.navAccount}>{username}</span>
          <button type="button" onClick={onSignOut} style={styles.signOutButton}>
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

// ==========================================
// 2. SUMMARY METRICS COMPONENT
// ==========================================
function MetricsOverview({ feedbacks }) {
  const total = feedbacks.length;
  const positive = feedbacks.filter((f) => f.sentiment === 'Positive').length;
  const negative = feedbacks.filter((f) => f.sentiment === 'Negative').length;
  const avgRating = total > 0 
    ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / total).toFixed(1) 
    : '0.0';

  return (
    <div style={styles.metricsGrid}>
      <div style={styles.metricCard}>
        <span style={styles.metricLabel}>Total Reviews</span>
        <span style={styles.metricValue}>{total}</span>
        <span style={styles.metricSub}>Aggregated Live</span>
      </div>
      <div style={styles.metricCard}>
        <span style={styles.metricLabel}>Average Rating</span>
        <span style={{ ...styles.metricValue, color: '#0284c7' }}>
          {avgRating} <small style={{ fontSize: '1rem' }}>/ 5</small>
        </span>
        <span style={styles.metricSub}>Cross-platform</span>
      </div>
      <div style={styles.metricCard}>
        <span style={styles.metricLabel}>Positive Ratio</span>
        <span style={{ ...styles.metricValue, color: '#16a34a' }}>
          {total > 0 ? Math.round((positive / total) * 100) : 0}%
        </span>
        <span style={styles.metricSub}>{positive} satisfied guests</span>
      </div>
      <div style={styles.metricCard}>
        <span style={styles.metricLabel}>Action Required</span>
        <span style={{ ...styles.metricValue, color: '#dc2626' }}>{negative}</span>
        <span style={styles.metricSub}>Urgent grievances</span>
      </div>
    </div>
  );
}

// ==========================================
// 3. REUSABLE FEEDBACK CARD COMPONENT
// ==========================================
function FeedbackCard({ guestName, source, rating, comment, sentiment, departmentTag, createdAt }) {
  const getBadgeStyle = (type) => {
    switch (type) {
      case 'Positive':
        return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
      case 'Negative':
        return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' };
      default:
        return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
    }
  };

  const badge = getBadgeStyle(sentiment);

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.guestName}>{guestName}</h3>
          <span style={styles.sourceTag}>{source}</span>
        </div>
        <div style={styles.badgeContainer}>
          <span
            style={{
              ...styles.sentimentBadge,
              backgroundColor: badge.bg,
              color: badge.color,
              borderColor: badge.border,
            }}
          >
            {sentiment}
          </span>
          <span style={styles.deptTag}>{departmentTag || 'General'}</span>
        </div>
      </div>

      <p style={styles.comment}>"{comment}"</p>

      <div style={styles.cardFooter}>
        <div style={styles.ratingStars}>
          {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
          <span style={styles.ratingNumber}>({rating}/5)</span>
        </div>
        <span style={styles.timestamp}>{createdAt ? new Date(createdAt).toLocaleDateString() : 'Recent'}</span>
      </div>
    </div>
  );
}

// ==========================================
// 4. MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filter, setFilter] = useState('All');
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState('');
  const [auth, setAuth] = useState(() => {
    const token = sessionStorage.getItem('authToken');
    return token
      ? { token, username: sessionStorage.getItem('authUsername') || '' }
      : null;
  });

  useEffect(() => {
    if (!auth?.token) {
      setFeedbacks([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setFeedbackError('');
    fetch('http://localhost:5000/api/feedback', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) {
          sessionStorage.removeItem('authToken');
          sessionStorage.removeItem('authUsername');
          if (active) setAuth(null);
          return null;
        }
        if (!response.ok) throw new Error(result.message || 'Unable to load feedback');
        return result;
      })
      .then((result) => {
        if (active && result) setFeedbacks(result.data || []);
      })
      .catch((error) => {
        if (active) {
          setFeedbacks([]);
          setFeedbackError(error.message || 'Unable to connect to the server');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [auth?.token]);

  const handleAuthenticated = ({ token, user }) => {
    sessionStorage.setItem('authToken', token);
    sessionStorage.setItem('authUsername', user.username);
    setAuth({ token, username: user.username });
  };

  const handleSignOut = async () => {
    try {
      await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
    } catch (error) {
      setFeedbackError(error.message || 'The server could not confirm sign-out');
    } finally {
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('authUsername');
      setAuth(null);
      setFeedbacks([]);
    }
  };

  const filteredFeedbacks =
    filter === 'All'
      ? feedbacks
      : feedbacks.filter((f) => f.sentiment === filter);

  if (!auth) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  return (
    <div style={styles.appContainer}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        username={auth.username}
        onSignOut={handleSignOut}
      />

      <main style={styles.mainContent}>
        {/* ================= TAB 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <>
            <div style={styles.headerSection}>
              <h2 style={styles.pageTitle}>Executive Feedback Dashboard</h2>
              <p style={styles.pageSubtitle}>
                Real-time review monitoring and automated sentiment breakdown.
              </p>
            </div>

            <MetricsOverview feedbacks={feedbacks} />

            <div style={styles.filterBar}>
              <span style={styles.filterLabel}>Filter Sentiment:</span>
              {['All', 'Positive', 'Neutral', 'Negative'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  style={{
                    ...styles.filterTab,
                    ...(filter === status ? styles.filterTabActive : {}),
                  }}
                >
                  {status}
                </button>
              ))}
            </div>

            {loading ? (
              <p style={{ color: '#64748b' }}>Loading feedback entries...</p>
            ) : (
              <>
                {feedbackError && <p role="alert" style={styles.feedbackError}>{feedbackError}</p>}
                <div style={styles.feedList}>
                  {filteredFeedbacks.map((item) => (
                    <FeedbackCard key={item._id || item.id} {...item} />
                  ))}
                  {!feedbackError && filteredFeedbacks.length === 0 && (
                    <p style={{ color: '#64748b' }}>No feedback entries yet.</p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ================= TAB 2: REVIEWS QUEUE ================= */}
        {activeTab === 'reviews' && (
          <div style={styles.headerSection}>
            <h2 style={styles.pageTitle}>Reviews Queue</h2>
            <p style={styles.pageSubtitle}>
              Multi-channel feeds from Google Reviews, TripAdvisor & Booking.com.
            </p>
            <div style={{ ...styles.card, marginTop: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Raw Review Queue</h3>
              <p style={{ color: '#475569', margin: 0 }}>
                Showing {feedbacks.length} items queued for continuous NLP analysis and category tagging.
              </p>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ACTION DESK ================= */}
        {activeTab === 'action' && (
          <div style={styles.headerSection}>
            <h2 style={styles.pageTitle}>Action Desk</h2>
            <p style={styles.pageSubtitle}>
              Urgent grievances and assigned service recovery tickets.
            </p>
            <div style={styles.actionDeskContainer}>
              {feedbacks
                .filter((f) => f.sentiment === 'Negative' || f.rating <= 2)
                .map((ticket) => (
                  <div key={ticket._id || ticket.id} style={styles.actionTicket}>
                    <div style={styles.ticketHeader}>
                      <span style={styles.priorityUrgent}>HIGH PRIORITY</span>
                      <span style={styles.timestamp}>
                        {ticket.source}
                      </span>
                    </div>
                    <h3 style={{ margin: '0.5rem 0', color: '#b91c1c' }}>
                      Grievance by {ticket.guestName}
                    </h3>
                    <p style={{ color: '#334155', margin: '0 0 1rem 0' }}>
                      "{ticket.comment}"
                    </p>
                    <div style={styles.ticketFooter}>
                      <span>Department: <strong>{ticket.departmentTag || 'Amenities'}</strong></span>
                      <button style={styles.resolveButton}>Assign Ticket</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================= TAB 4: ANALYTICS ================= */}
        {activeTab === 'analytics' && (
          <div style={styles.headerSection}>
            <h2 style={styles.pageTitle}>Sentiment Analytics</h2>
            <p style={styles.pageSubtitle}>
              Department-level performance breakdown and satisfaction ratios.
            </p>
            <div style={styles.analyticsGrid}>
              <div style={styles.analyticsCard}>
                <h4>Housekeeping</h4>
                <p style={styles.analyticsStat}>92% Positive</p>
                <small style={{ color: '#16a34a' }}>↑ 4% from last week</small>
              </div>
              <div style={styles.analyticsCard}>
                <h4>Front Desk</h4>
                <p style={styles.analyticsStat}>84% Positive</p>
                <small style={{ color: '#16a34a' }}>↑ 1% from last week</small>
              </div>
              <div style={styles.analyticsCard}>
                <h4>Amenities & Dining</h4>
                <p style={styles.analyticsStat}>60% Positive</p>
                <small style={{ color: '#dc2626' }}>↓ 5% (Needs Review)</small>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================
// 5. STYLES OBJECT
// ==========================================
const styles = {
  appContainer: {
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#0f172a',
    margin: 0,
  },
  navbar: {
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    padding: '0.75rem 0',
  },
  navContainer: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoIcon: {
    width: '38px',
    height: '38px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '1.25rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  badgeAi: {
    backgroundColor: '#0369a1',
    color: '#e0f2fe',
    fontSize: '0.7rem',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    marginLeft: '0.25rem',
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    margin: 0,
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  navAccount: {
    color: '#e2e8f0',
    fontSize: '0.8rem',
    marginLeft: '0.5rem',
  },
  signOutButton: {
    background: 'transparent',
    border: '1px solid #64748b',
    color: '#e2e8f0',
    padding: '0.45rem 0.7rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  feedbackError: {
    color: '#b91c1c',
    marginBottom: '0.75rem',
  },
  navButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    padding: '0.5rem 0.85rem',
    fontSize: '0.875rem',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  navButtonActive: {
    color: '#ffffff',
    backgroundColor: '#1e293b',
    fontWeight: '600',
  },
  mainContent: {
    maxWidth: '1100px',
    margin: '2rem auto',
    padding: '0 1.5rem',
  },
  headerSection: {
    marginBottom: '1.5rem',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    margin: '0 0 0.25rem 0',
  },
  pageSubtitle: {
    color: '#64748b',
    fontSize: '0.875rem',
    margin: 0,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  metricCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  metricValue: {
    fontSize: '1.85rem',
    fontWeight: '800',
    margin: '0.25rem 0',
    color: '#0f172a',
  },
  metricSub: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.25rem',
  },
  filterLabel: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#64748b',
    marginRight: '0.5rem',
  },
  filterTab: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#475569',
    padding: '0.4rem 0.85rem',
    borderRadius: '20px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  filterTabActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
    color: '#ffffff',
    fontWeight: '600',
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  },
  guestName: {
    fontSize: '1rem',
    fontWeight: '600',
    margin: '0 0 0.15rem 0',
  },
  sourceTag: {
    fontSize: '0.75rem',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
  },
  badgeContainer: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  sentimentBadge: {
    fontSize: '0.75rem',
    fontWeight: '600',
    padding: '0.25rem 0.6rem',
    borderRadius: '12px',
    border: '1px solid transparent',
  },
  deptTag: {
    fontSize: '0.75rem',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    padding: '0.25rem 0.6rem',
    borderRadius: '12px',
    fontWeight: '500',
  },
  comment: {
    fontSize: '0.925rem',
    lineHeight: '1.5',
    color: '#334155',
    margin: '0 0 1rem 0',
    fontStyle: 'italic',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #f1f5f9',
    paddingTop: '0.75rem',
  },
  ratingStars: {
    color: '#f59e0b',
    fontSize: '0.9rem',
    letterSpacing: '0.1em',
  },
  ratingNumber: {
    color: '#64748b',
    fontSize: '0.75rem',
    marginLeft: '0.35rem',
  },
  timestamp: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  actionDeskContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  actionTicket: {
    backgroundColor: '#ffffff',
    border: '1px solid #fecaca',
    borderLeft: '5px solid #dc2626',
    borderRadius: '8px',
    padding: '1.25rem',
  },
  ticketHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityUrgent: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  ticketFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #f3f4f6',
    paddingTop: '0.75rem',
    fontSize: '0.85rem',
  },
  resolveButton: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  analyticsCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1.25rem',
  },
  analyticsStat: {
    fontSize: '1.5rem',
    fontWeight: '700',
    margin: '0.5rem 0',
  },
};