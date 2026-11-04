import './App.css';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <h2>🎁 GiftWish</h2>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#login">Login</a>
        </div>
      </nav>

      <main className="hero" id="home">
        <div className="hero-content">
          <p className="tagline">✨ THE SEASON OF GIVING ✨</p>

          <h1>
            Make Christmas
            <br />
            <span>More Magical.</span>
          </h1>

          <p className="description">
            Create your Christmas wishlist, organize gift
            exchanges, and make someone's holiday special.
          </p>

          <button className="start-button">
            Get Started 🎄
          </button>
        </div>

        <div className="gift-decoration">
          🎁
        </div>
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

      <footer>
        <p>Made with ❤️ for the season of giving.</p>
        <p>© 2026 GiftWish</p>
      </footer>
    </div>
  );
}

export default App;