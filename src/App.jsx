import { useState, useEffect } from 'react';
import './App.css';

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
  const [exchange, setExchange] = useState(null);
  const [exchanges, setExchanges] = useState([]);

  // Load the user's exchanges
  async function loadExchanges() {
    try {
      const response = await fetch(
        'http://localhost:5000/api/exchanges',
        { credentials: 'include' }
      );

      const data = await response.json();

      if (response.ok) {
        setExchanges(data.exchanges);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Check existing login
  useEffect(() => {
    fetch('http://localhost:5000/api/me', {
      credentials: 'include'
    })
      .then(response => {
        if (!response.ok) return null;
        return response.json();
      })
      .then(data => {
        if (data && data.user) {
          setUser(data.user);
          setPage('dashboard');
          loadExchanges();
        }
      })
      .catch(error => console.error(error));
  }, []);

  // Register or login
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    const url = isRegister
      ? 'http://localhost:5000/api/register'
      : 'http://localhost:5000/api/login';

    const body = isRegister
      ? { name, email, password }
      : { email, password };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        return;
      }

      if (isRegister) {
        setMessage('Account created! You can now log in.');
        setIsRegister(false);
        setName('');
        setPassword('');
      } else {
        setUser(data.user);
        setPage('dashboard');
        setMessage('');
        setEmail('');
        setPassword('');
        loadExchanges();
      }
    } catch (error) {
      setMessage('Cannot connect to the server.');
    }
  }

  // Create an exchange
  async function handleCreateExchange(event) {
    event.preventDefault();
    setMessage('');

    try {
      const response = await fetch(
        'http://localhost:5000/api/exchanges',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            event_name: eventName,
            event_date: eventDate,
            gift_budget: giftBudget
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        return;
      }

      setExchange(data.exchange);
      setEventName('');
      setEventDate('');
      setGiftBudget('');
      setMessage(data.message);

      loadExchanges();
    } catch (error) {
      setMessage('Could not connect to the server.');
    }
  }

  // Join an exchange using an invitation code
  async function handleJoinExchange(event) {
    event.preventDefault();
    setMessage('');

    try {
      const response = await fetch(
        'http://localhost:5000/api/exchanges/join',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            invite_code: inviteCode
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        return;
      }

      setMessage(data.message);
      setInviteCode('');
      loadExchanges();

    } catch (error) {
      setMessage('Could not connect to the server.');
    }
  }

  // Logout
  async function handleLogout() {
    try {
      await fetch('http://localhost:5000/api/logout', {
        method: 'POST',
        credentials: 'include'
      });

      setUser(null);
      setExchange(null);
      setExchanges([]);
      setPage('home');
      setMessage('');
      setEmail('');
      setPassword('');
    } catch (error) {
      setMessage('Logout failed.');
    }
  }

  return (
    <div className="app">

      <nav className="navbar">
        <h2>🎁 GiftWish</h2>

        <div className="nav-links">
          <a href="#home" onClick={() => setPage('home')}>Home</a>
          <a href="#about">About</a>

          {user ? (
            <button onClick={handleLogout}>Logout</button>
          ) : (
            <button onClick={() => {
              setPage('auth');
              setIsRegister(false);
              setMessage('');
            }}>
              Login
            </button>
          )}
        </div>
      </nav>

      {page === 'home' && (
        <>
          <main className="hero" id="home">
            <div className="hero-content">
              <p className="tagline">✨ THE SEASON OF GIVING ✨</p>
              <h1>
                Make Christmas<br />
                <span>More Magical.</span>
              </h1>
              <p className="description">
                Create your Christmas wishlist, organize gift
                exchanges, and make someone's holiday special.
              </p>
              <button
                className="start-button"
                onClick={() => {
                  setPage('auth');
                  setIsRegister(true);
                  setMessage('');
                }}
              >
                Get Started 🎄
              </button>
            </div>
            <div className="gift-decoration">🎁</div>
          </main>

          <section className="features" id="about">
            <h2>Everything for a Magical Christmas</h2>
            <div className="feature-list">
              <div className="feature-card">
                <span>📝</span>
                <h3>Create Wishlists</h3>
                <p>Share the gifts you would love to receive.</p>
              </div>
              <div className="feature-card">
                <span>🎅</span>
                <h3>Secret Santa</h3>
                <p>Get randomly assigned someone to surprise.</p>
              </div>
              <div className="feature-card">
                <span>🎄</span>
                <h3>Share the Joy</h3>
                <p>Make your Christmas exchange memorable.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {page === 'auth' && (
        <main className="auth-section">
          <div className="auth-card">
            <h1>
              {isRegister ? 'Create an Account 🎁' : 'Welcome Back 🎄'}
            </h1>

            <p>
              {isRegister
                ? 'Join GiftWish and make this Christmas special!'
                : 'Log in to continue your Christmas journey.'}
            </p>

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                />
              )}

              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                minLength="6"
                required
              />

              <button type="submit" className="start-button">
                {isRegister ? 'Register 🎁' : 'Login 🎄'}
              </button>
            </form>

            {message && <p className="message">{message}</p>}

            <p className="switch-text">
              {isRegister
                ? 'Already have an account?'
                : "Don't have an account?"}

              <button onClick={() => {
                setIsRegister(!isRegister);
                setMessage('');
              }}>
                {isRegister ? 'Login' : 'Register'}
              </button>
            </p>

            <button
              className="back-button"
              onClick={() => {
                setPage('home');
                setMessage('');
              }}
            >
              ← Back to Home
            </button>
          </div>
        </main>
      )}

      {page === 'dashboard' && user && (
        <main className="dashboard">
          <div className="dashboard-card">

            <h1>Welcome, {user.name}! 🎄</h1>
            <p>Your Christmas gift exchange journey starts here!</p>

            <h2>My Gift Exchanges 🎁</h2>

            {exchanges.length === 0 ? (
              <p>You haven't joined any exchanges yet.</p>
            ) : (
              <div className="exchange-list">
                {exchanges.map(item => (
                  <div
                    className="exchange-result"
                    key={item.exchange_id}
                  >
                    <h3>{item.event_name}</h3>
                    <p>Organizer: {item.organizer_name}</p>
                    <p>Status: {item.status}</p>
                    {item.organizer_id === user.user_id && (
                      <>
                        <p>Invitation Code:</p>
                        <h2>{item.invite_code}</h2>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h2>Join an Exchange 🎅</h2>

            <form onSubmit={handleJoinExchange}>
              <input
                type="text"
                placeholder="Enter invitation code"
                value={inviteCode}
                onChange={event => setInviteCode(event.target.value.toUpperCase())}
                required
              />

              <button type="submit" className="start-button">
                Join Exchange 🎁
              </button>
            </form>

            <h2>Create a Gift Exchange 🎁</h2>

            <form onSubmit={handleCreateExchange}>
              <input
                type="text"
                placeholder="Event name (e.g. Family Christmas Party)"
                value={eventName}
                onChange={event => setEventName(event.target.value)}
                required
              />

              <input
                type="date"
                value={eventDate}
                onChange={event => setEventDate(event.target.value)}
              />

              <input
                type="number"
                placeholder="Gift budget (PHP)"
                min="0"
                step="0.01"
                value={giftBudget}
                onChange={event => setGiftBudget(event.target.value)}
              />

              <button type="submit" className="start-button">
                Create Exchange 🎄
              </button>
            </form>

            {message && <p className="message">{message}</p>}

            {exchange && (
              <div className="exchange-result">
                <h3>Exchange Created! 🎉</h3>
                <p><strong>Event:</strong> {exchange.event_name}</p>
                <p><strong>Invitation Code:</strong></p>
                <h2>{exchange.invite_code}</h2>
                <p>Share this code with your friends!</p>
              </div>
            )}

            <button className="back-button" onClick={handleLogout}>
              Logout
            </button>

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