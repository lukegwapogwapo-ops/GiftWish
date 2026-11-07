import { useState, useEffect } from 'react';
import './App.css';

const API = 'http://localhost:5000/api';

function App() {
  const [page, setPage] = useState('home');
  const [isRegister, setIsRegister] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [giftBudget, setGiftBudget] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [exchanges, setExchanges] = useState([]);
  const [selectedExchange, setSelectedExchange] = useState(null);

  const [participants, setParticipants] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [secretSanta, setSecretSanta] = useState('');

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong.');
    }
    return data;
  }

  async function loadExchanges() {
    try {
      const data = await apiRequest('/exchanges');
      setExchanges(data.exchanges || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    apiRequest('/me')
      .then(data => {
        if (data.user) {
          setUser(data.user);
          setPage('dashboard');
          loadExchanges();
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    try {
      const path = isRegister ? '/register' : '/login';
      const body = isRegister
        ? { name, email, password }
        : { email, password };
      const data = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (isRegister) {
        setMessage('Account created! You can now log in.');
        setIsRegister(false);
        setName('');
        setPassword('');
      } else {
        setUser(data.user);
        setPage('dashboard');
        setEmail('');
        setPassword('');
        setMessage('');
        loadExchanges();
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleCreateExchange(event) {
    event.preventDefault();
    setMessage('');
    try {
      const data = await apiRequest('/exchanges', {
        method: 'POST',
        body: JSON.stringify({
          event_name: eventName,
          event_date: eventDate,
          gift_budget: giftBudget
        })
      });
      setEventName('');
      setEventDate('');
      setGiftBudget('');
      setMessage(data.message || 'Exchange created successfully!');
      await loadExchanges();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleJoinExchange(event) {
    event.preventDefault();
    setMessage('');
    try {
      const data = await apiRequest('/exchanges/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode })
      });
      setInviteCode('');
      setMessage(data.message);
      await loadExchanges();
    } catch (error) {
      setMessage(error.message);
    }
  }

async function handleDisbandExchange(item) {
  const confirmed = window.confirm(
    `Are you sure you want to disband "${item.event_name}"? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    const data = await apiRequest(`/exchanges/${item.exchange_id}`, {
      method: 'DELETE'
    });

    setMessage(data.message);
    await loadExchanges();
  } catch (error) {
    setMessage(error.message);
  }
}

  async function openExchange(item) {
    setSelectedExchange(item);
    setPage('exchange');
    setMessage('');
    setParticipants([]);
    setWishlist([]);
    setRecipient(null);
    setSecretSanta('');
    setItemName('');
    setItemDescription('');
    setEditingItemId(null);

    try {
      const wishlistData = await apiRequest(`/wishlist/${item.exchange_id}`);
      setWishlist(wishlistData.wishlist || []);
    } catch (error) {
      setMessage(error.message);
    }

    try {
  const participantData = await apiRequest(
    `/exchanges/${item.exchange_id}/participants`
  );
  setParticipants(participantData.participants || []);
} catch (error) {
  setMessage(error.message);
}

    if (item.status === 'assigned') {
      try {
        const recipientData = await apiRequest(
          `/exchanges/${item.exchange_id}/my-recipient`
        );
        setRecipient(recipientData);
      } catch (error) {
        // The organizer may not be a participant in older exchange records.
      }
    }

    if (item.status === 'completed') {
      try {
        const santaData = await apiRequest(
          `/exchanges/${item.exchange_id}/my-secret-santa`
        );
        setSecretSanta(santaData.secret_santa || '');
      } catch (error) {
        setMessage(error.message);
      }
    }
  }

  async function refreshExchange() {
    await loadExchanges();
    const data = await apiRequest('/exchanges');
    const updated = (data.exchanges || []).find(
      item => item.exchange_id === selectedExchange.exchange_id
    );
    if (updated) {
      setSelectedExchange(updated);
      await openExchange(updated);
    }
  }

  async function saveWishlistItem(event) {
    event.preventDefault();
    setMessage('');

    try {
      if (editingItemId) {
        const data = await apiRequest(`/wishlist/${editingItemId}`, {
          method: 'PUT',
          body: JSON.stringify({
            item_name: itemName,
            description: itemDescription
          })
        });
        setMessage(data.message);
      } else {
        const data = await apiRequest('/wishlist', {
          method: 'POST',
          body: JSON.stringify({
            exchange_id: selectedExchange.exchange_id,
            item_name: itemName,
            description: itemDescription
          })
        });
        setMessage(data.message);
      }

      setItemName('');
      setItemDescription('');
      setEditingItemId(null);
      const data = await apiRequest(`/wishlist/${selectedExchange.exchange_id}`);
      setWishlist(data.wishlist || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEditing(item) {
    setEditingItemId(item.item_id);
    setItemName(item.item_name);
    setItemDescription(item.description || '');
    setMessage('');
  }

  async function deleteWishlistItem(itemId) {
    if (!window.confirm('Delete this wishlist item?')) return;
    try {
      const data = await apiRequest(`/wishlist/${itemId}`, {
        method: 'DELETE'
      });
      setMessage(data.message);
      const updated = await apiRequest(`/wishlist/${selectedExchange.exchange_id}`);
      setWishlist(updated.wishlist || []);
    } catch (error) {
      setMessage(error.message);
    }
  }
async function removeParticipant(userId) {
  if (!window.confirm('Remove this participant from the exchange?')) return;

  try {
    const data = await apiRequest(
      `/exchanges/${selectedExchange.exchange_id}/participants/${userId}`,
      { method: 'DELETE' }
    );

    setMessage(data.message);
    await refreshExchange();
  } catch (error) {
    setMessage(error.message);
  }
}

async function leaveExchange() {
  if (!window.confirm('Leave this gift exchange?')) return;

  try {
    const data = await apiRequest(
      `/exchanges/${selectedExchange.exchange_id}/leave`,
      { method: 'DELETE' }
    );

    setMessage(data.message);
    setSelectedExchange(null);
    setPage('dashboard');
    await loadExchanges();
  } catch (error) {
    setMessage(error.message);
  }
}
  async function startDraw() {
    const confirmed = window.confirm(
      'Start the Secret Santa draw? Assignments will be created and cannot be changed from this page.'
    );
    if (!confirmed) return;

    try {
      const data = await apiRequest(`/exchanges/${selectedExchange.exchange_id}/draw`, {
        method: 'POST'
      });
      setMessage(data.message || 'Secret Santa draw completed!');
      await refreshExchange();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function completeExchange() {
    if (!window.confirm('Mark this gift exchange as completed and reveal Secret Santas?')) {
      return;
    }
    try {
      const data = await apiRequest(`/exchanges/${selectedExchange.exchange_id}/complete`, {
        method: 'PUT'
      });
      setMessage(data.message);
      await refreshExchange();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/logout', { method: 'POST' });
    } catch (error) {
      // Return to the login screen even if the logout request fails.
    }
    setUser(null);
    setExchanges([]);
    setSelectedExchange(null);
    setPage('home');
    setMessage('');
    setEmail('');
    setPassword('');
  }

  return (
    <div className="app">
      <div className="snowfall" aria-hidden="true">
  <span>❄</span>
  <span>❅</span>
  <span>❄</span>
  <span>❅</span>
  <span>❄</span>
  <span>❅</span>
  <span>❄</span>
  <span>❅</span>
  <span>❄</span>
  <span>❅</span>
  <span>❄</span>
<span>❅</span>
<span>❄</span>
<span>❅</span>
<span>❄</span>
<span>❅</span>
<span>❄</span>
<span>❅</span>
<span>❄</span>
<span>❅</span>
</div>
      <nav className="navbar">
        <h2>🎁 GiftWish</h2>
        <div className="nav-links">
          <button onClick={() => setPage(user ? 'dashboard' : 'home')}>Home</button>
          <a href="#about">About</a>
          {user && <button onClick={handleLogout}>Logout</button>}
        </div>
      </nav>

      {page === 'home' && (
        <>
          <main className="hero" id="home">
            <div className="hero-content">
              <p className="tagline">✨ THE SEASON OF GIVING ✨</p>
              <h1>Make Christmas<br /><span>More Magical.</span></h1>
              <p className="description">
                Create your Christmas wishlist, organize gift exchanges,
                and make someone's holiday special.
              </p>
              <button className="start-button" onClick={() => {
                setPage('auth');
                setIsRegister(true);
                setMessage('');
              }}>Get Started 🎄</button>
            </div>
            <div className="gift-decoration">🎁</div>
          </main>
          <section className="features" id="about">
            <h2>Everything for a Magical Christmas</h2>
            <div className="feature-list">
              <div className="feature-card"><span>📝</span><h3>Create Wishlists</h3><p>Share the gifts you would love to receive.</p></div>
              <div className="feature-card"><span>🎅</span><h3>Secret Santa</h3><p>Get randomly assigned someone to surprise.</p></div>
              <div className="feature-card"><span>🎄</span><h3>Share the Joy</h3><p>Make your Christmas exchange memorable.</p></div>
            </div>
          </section>
        </>
      )}

      {page === 'auth' && (
        <main className="auth-section">
          <div className="auth-card">
            <h1>{isRegister ? 'Create an Account 🎁' : 'Welcome Back 🎄'}</h1>
            <p>{isRegister ? 'Join GiftWish and make this Christmas special!' : 'Log in to continue your Christmas journey.'}</p>
            <form onSubmit={handleSubmit}>
              {isRegister && <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />}
              <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} minLength="6" required />
              <button type="submit" className="start-button">{isRegister ? 'Register 🎁' : 'Login 🎄'}</button>
            </form>
            {message && <p className="message">{message}</p>}
            <p className="switch-text">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}
              <button onClick={() => { setIsRegister(!isRegister); setMessage(''); }}>{isRegister ? 'Login' : 'Register'}</button>
            </p>
            <button className="back-button" onClick={() => { setPage('home'); setMessage(''); }}>← Back to Home</button>
          </div>
        </main>
      )}

     

{page === 'dashboard' && user && (
  <main className="dashboard">
    <div className="dashboard-card dashboard-wide">
      <h1>Welcome, {user.name}! 🎄</h1>
      <p>Your Christmas gift exchange journey starts here!</p>

      {/* My Gift Exchanges */}
      <section className="dashboard-section">
        <h2>My Gift Exchanges 🎁</h2>

        {exchanges.length === 0 ? (
          <p>You haven't joined any exchanges yet.</p>
        ) : (
          <div className="exchange-list">
            {exchanges.map(item => (
              <div className="exchange-result" key={item.exchange_id}>
                <h3>{item.event_name}</h3>
                <p>Organizer: {item.organizer_name}</p>
                <p>Status: <strong>{item.status}</strong></p>

                {item.event_date && (
                  <p>Date: {new Date(item.event_date).toLocaleDateString()}</p>
                )}

                {item.organizer_id === user.user_id && (
                  <p>
                    Invitation code:{' '}
                    <strong className="invite-code">{item.invite_code}</strong>
                  </p>
                )}

                <button
  className="secondary-button"
  onClick={() => openExchange(item)}
>
  View Exchange
</button>

{Number(item.organizer_id) === Number(user.user_id) &&
 Number(item.participant_count) === 0 &&
 item.status === 'open' && (
  <button
    className="secondary-button"
    onClick={() => handleDisbandExchange(item)}
  >
    Disband Exchange
  </button>
)}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create and Join Exchange */}
      <div className="forms-grid">
        <section className="dashboard-section">
          <h2>Create a Gift Exchange 🎁</h2>
          <form onSubmit={handleCreateExchange} className="stack-form">
            <input
              type="text"
              placeholder="Event name"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              required
            />
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />
            <input
              type="number"
              placeholder="Gift budget (PHP)"
              min="0"
              step="0.01"
              value={giftBudget}
              onChange={e => setGiftBudget(e.target.value)}
            />
            <button type="submit" className="start-button">
              Create Exchange 🎄
            </button>
          </form>
        </section>

        <section className="dashboard-section">
          <h2>Join an Exchange 🎅</h2>
          <form onSubmit={handleJoinExchange} className="stack-form">
            <input
              type="text"
              placeholder="Enter invitation code"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              required
            />
            <button type="submit" className="start-button">
              Join Exchange 🎁
            </button>
          </form>
        </section>
      </div>

      {message && <p className="message">{message}</p>}
    </div>
  </main>
)}

      {page === 'exchange' && selectedExchange && user && (
        <main className="dashboard">
          <div className="dashboard-card dashboard-wide">
            <button className="back-button back-left" onClick={() => { setPage('dashboard'); setMessage(''); loadExchanges(); }}>← Back to Dashboard</button>
            <h1>{selectedExchange.event_name} 🎄</h1>
            <p>Organizer: {selectedExchange.organizer_name}</p>
            <p>Status: <strong>{selectedExchange.status}</strong></p>
            {selectedExchange.event_date && <p>Event date: {new Date(selectedExchange.event_date).toLocaleDateString()}</p>}
            {selectedExchange.gift_budget !== null && selectedExchange.gift_budget !== undefined && <p>Gift budget: ₱{selectedExchange.gift_budget}</p>}
            {selectedExchange.organizer_id === user.user_id && <p>Invitation code: <strong className="invite-code">{selectedExchange.invite_code}</strong></p>}

            <section className="dashboard-section">
  <h2>Participants 👥</h2>

  {participants.length === 0 ? (
    <p>No participants found yet.</p>
  ) : (
    <ul className="participant-list">
      {participants.map((person, index) => (
        <li key={`${person.user_id}-${index}`}>
          <span>{person.name}</span>

          {selectedExchange.status === 'open' &&
            selectedExchange.organizer_id === user.user_id &&
            person.user_id !== user.user_id && (
              <button
                className="danger-button"
                onClick={() => removeParticipant(person.user_id)}
              >
                Remove
              </button>
            )}
        </li>
      ))}
    </ul>
  )}

  {selectedExchange.status === 'open' &&
    selectedExchange.organizer_id !== user.user_id && (
      <button
        className="danger-button"
        onClick={leaveExchange}
      >
        Leave Exchange
      </button>
    )}
</section>  
            <section className="dashboard-section">
              <h2>My Wishlist 🎁</h2>
              <p>Only you can manage and view your personal wishlist here.</p>
              {selectedExchange.status === 'open' && (
                <form onSubmit={saveWishlistItem} className="stack-form wishlist-form">
                  <input type="text" placeholder="Gift idea (e.g. Basketball)" value={itemName} onChange={e => setItemName(e.target.value)} required />
                  <textarea placeholder="Description (optional)" value={itemDescription} onChange={e => setItemDescription(e.target.value)} rows="3" />
                  <button type="submit" className="start-button">{editingItemId ? 'Save Changes' : 'Add to Wishlist'}</button>
                  {editingItemId && <button type="button" className="secondary-button" onClick={() => { setEditingItemId(null); setItemName(''); setItemDescription(''); }}>Cancel Edit</button>}
                </form>
              )}
              {wishlist.length === 0 ? <p>Your wishlist is empty. Add your gift ideas above!</p> : (
                <div className="wishlist-list">
                  {wishlist.map(item => (
                    <div className="wishlist-item" key={item.item_id}>
                      <div><strong>{item.item_name}</strong>{item.description && <p>{item.description}</p>}</div>
                      {selectedExchange.status === 'open' && (
                        <div className="item-actions">
                          <button className="secondary-button" onClick={() => startEditing(item)}>Edit</button>
                          <button className="danger-button" onClick={() => deleteWishlistItem(item.item_id)}>Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {selectedExchange.status === 'open' && selectedExchange.organizer_id === user.user_id && (
              <section className="dashboard-section organizer-actions">
                <h2>Organizer Controls</h2>
                <p>Make sure everyone has joined before starting the draw. At least two participants are required.</p>
                <button className="start-button" onClick={startDraw}>Start Secret Santa Draw 🎅</button>
              </section>
            )}

            {selectedExchange.status === 'assigned' && (
              <section className="dashboard-section result-panel">
                <h2>Your Secret Santa Assignment 🎁</h2>
                {recipient ? (
                  <>
                    <p>You are giving a gift to:</p>
                    <h3>{recipient.recipient_name}</h3>
                    <h4>Their wishlist</h4>
                    {recipient.wishlist && recipient.wishlist.length > 0 ? recipient.wishlist.map((item, index) => (
                      <div className="wishlist-item" key={index}><strong>{item.item_name}</strong>{item.description && <p>{item.description}</p>}</div>
                    )) : <p>They haven't added any wishlist items yet.</p>}
                  </>
                ) : <p>Loading your assignment...</p>}
                {selectedExchange.organizer_id === user.user_id && (
                  <div className="organizer-actions">
                    <p>When the gift exchange has finished, mark it as completed to reveal each participant's Secret Santa.</p>
                    <button className="start-button" onClick={completeExchange}>Complete Exchange</button>
                  </div>
                )}
              </section>
            )}

            {selectedExchange.status === 'completed' && (
              <section className="dashboard-section result-panel">
                <h2>Secret Santa Reveal 🎉</h2>
                {secretSanta ? <h3>Your Secret Santa was {secretSanta}!</h3> : <p>Your Secret Santa reveal is not available yet.</p>}
              </section>
            )}

            {message && <p className="message">{message}</p>}
          </div>
        </main>
      )}

      <footer>
        <p>Made with ❤️ for the season of giving.</p>
        <p>© 2026 GiftWish</p>
      </footer>
    </div>
  );
}

export default App;
