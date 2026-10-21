import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "https://api.github.com/users";
const HISTORY_KEY = "gpf-search-history";
const THEME_KEY = "gpf-theme";
const MAX_HISTORY = 8;
const REPOS_PREVIEW = 6;

// GitHub usernames: letters, numbers and single hyphens (not at the start/end), max 39 chars.
const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage unavailable - fall through to the system preference
  }
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC", // same calendar date GitHub stores, whatever the viewer's timezone
  });
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-value">{value.toLocaleString()}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function RepoCard({ repo }) {
  return (
    <li className="repo">
      <div className="repo-top">
        <a
          className="repo-name"
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {repo.name}
        </a>
        {repo.fork && <span className="badge">Fork</span>}
      </div>
      <p className="repo-desc">{repo.description || "No description provided."}</p>
      <div className="repo-meta">
        {repo.language && <span>● {repo.language}</span>}
        <span>⭐ {repo.stargazers_count.toLocaleString()}</span>
        <span>🍴 {repo.forks_count.toLocaleString()}</span>
        <span>Updated {formatDate(repo.updated_at)}</span>
      </div>
    </li>
  );
}

export default function App() {
  const [input, setInput] = useState(""); // what is typed in the search bar
  const [username, setUsername] = useState(""); // the name that was actually searched
  const [searchId, setSearchId] = useState(0); // lets us re-run the same search
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [reposFailed, setReposFailed] = useState(false);
  const [showAllRepos, setShowAllRepos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(loadHistory);
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply + remember the theme.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  // Remember the search history.
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // ignore storage errors
    }
  }, [history]);

  // Fetch the profile (and repos) whenever a new search is submitted.
  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    async function fetchProfile() {
      setLoading(true);
      setError("");
      setUser(null);
      setRepos([]);
      setReposFailed(false);
      setShowAllRepos(false);

      try {
        const userRes = await fetch(
          `${API_BASE}/${encodeURIComponent(username)}`,
          { signal }
        );

        if (userRes.status === 404) {
          throw new Error(
            `No GitHub user named "${username}" was found. Check the spelling and try again.`
          );
        }
        if (userRes.status === 403 || userRes.status === 429) {
          throw new Error(
            "GitHub's API rate limit was reached. Please wait a few minutes and try again."
          );
        }
        if (!userRes.ok) {
          throw new Error(
            `Something went wrong (status ${userRes.status}). Please try again.`
          );
        }

        const userData = await userRes.json();

        // Repositories are a bonus: if this part fails we still show the profile.
        let repoData = [];
        let repoFailure = false;
        if (userData.public_repos > 0) {
          try {
            const repoRes = await fetch(
              `${API_BASE}/${encodeURIComponent(userData.login)}/repos?per_page=100&sort=updated`,
              { signal }
            );
            if (repoRes.ok) {
              repoData = await repoRes.json();
            } else {
              repoFailure = true;
            }
          } catch (repoErr) {
            if (repoErr.name === "AbortError") throw repoErr;
            repoFailure = true;
          }
        }

        setUser(userData);
        setRepos(repoData);
        setReposFailed(repoFailure);
        setHistory((prev) =>
          [
            userData.login,
            ...prev.filter((n) => n.toLowerCase() !== userData.login.toLowerCase()),
          ].slice(0, MAX_HISTORY)
        );
      } catch (err) {
        if (err.name === "AbortError") return; // a newer search replaced this one
        setError(
          err instanceof TypeError
            ? "Couldn't reach GitHub. Check your internet connection and try again."
            : err.message
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    fetchProfile();

    // Cancel the request if the user searches again or leaves the page.
    return () => controller.abort();
  }, [username, searchId]);

  function showProblem(message) {
    setUsername(""); // also cancels any request that is still running
    setUser(null);
    setRepos([]);
    setError(message);
  }

  function runSearch(rawName) {
    const name = rawName.trim();
    if (!name) {
      showProblem("Please enter a GitHub username.");
      return;
    }
    if (!USERNAME_PATTERN.test(name)) {
      showProblem(
        `"${name}" isn't a valid GitHub username. Use only letters, numbers and single hyphens (max 39 characters).`
      );
      return;
    }
    setUsername(name);
    setSearchId((n) => n + 1);
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(input);
  }

  function handleHistoryClick(name) {
    setInput(name);
    runSearch(name);
  }

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  const visibleRepos = showAllRepos ? repos : repos.slice(0, REPOS_PREVIEW);
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>GitHub Profile Finder</h1>
          <p className="subtitle">Search any GitHub username to see their profile at a glance.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${nextTheme} mode`}
        >
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </header>

      <form className="search" onSubmit={handleSubmit} role="search">
        <label htmlFor="username" className="sr-only">
          GitHub username
        </label>
        <input
          id="username"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a GitHub username, e.g. octocat"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {history.length > 0 && (
        <section className="history" aria-label="Search history">
          <div className="history-head">
            <h2>Recent searches</h2>
            <button type="button" className="link-btn" onClick={() => setHistory([])}>
              Clear
            </button>
          </div>
          <ul className="chips">
            {history.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className="chip"
                  onClick={() => handleHistoryClick(name)}
                  disabled={loading}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading && (
        <div className="status" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Loading profile…
        </div>
      )}

      {error && !loading && (
        <div className="status status-error" role="alert">
          ⚠️ {error}
        </div>
      )}

      {!user && !loading && !error && (
        <p className="hint">
          Type a username above to get started — or try{" "}
          <button type="button" className="link-btn" onClick={() => handleHistoryClick("octocat")}>
            octocat
          </button>
          .
        </p>
      )}

      {user && !loading && (
        <main>
          <article className="card profile">
            <img
              className="avatar"
              src={user.avatar_url}
              alt={`${user.login}'s profile picture`}
              width="120"
              height="120"
            />
            <div className="profile-info">
              <h2 className="profile-name">{user.name || user.login}</h2>
              <p className="profile-login">@{user.login}</p>
              <p className="profile-bio">{user.bio || "This user hasn't added a bio yet."}</p>
              <ul className="meta">
                {user.location && <li>📍 {user.location}</li>}
                {user.company && <li>🏢 {user.company}</li>}
                <li>📅 Joined {formatDate(user.created_at)}</li>
              </ul>
              <a
                className="btn btn-primary"
                href={user.html_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit GitHub Profile ↗
              </a>
            </div>
          </article>

          <section className="stats" aria-label="GitHub statistics">
            <Stat label="Repositories" value={user.public_repos} />
            <Stat label="Followers" value={user.followers} />
            <Stat label="Following" value={user.following} />
          </section>

          <section className="repos" aria-label="Public repositories">
            <h2>Public repositories</h2>
            {reposFailed && (
              <p className="note">Couldn't load the repository list right now. Try searching again later.</p>
            )}
            {!reposFailed && repos.length === 0 && (
              <p className="note">This user has no public repositories yet.</p>
            )}
            {repos.length > 0 && (
              <>
                <ul className="repo-grid">
                  {visibleRepos.map((repo) => (
                    <RepoCard key={repo.id} repo={repo} />
                  ))}
                </ul>
                {repos.length > REPOS_PREVIEW && (
                  <button
                    type="button"
                    className="btn btn-ghost show-more"
                    onClick={() => setShowAllRepos((v) => !v)}
                  >
                    {showAllRepos ? "Show fewer" : `Show all ${repos.length} repositories`}
                  </button>
                )}
                {user.public_repos > repos.length && (
                  <p className="note">
                    Showing the {repos.length} most recently updated repositories.
                  </p>
                )}
              </>
            )}
          </section>
        </main>
      )}

      <footer className="footer">
        Built with React and the GitHub REST API · Week 06 task
      </footer>
    </div>
  );
}
