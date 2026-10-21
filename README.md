# GitHub Profile Finder

A small React app that looks up any GitHub user through the public GitHub REST API and shows their profile, stats and repositories. Built for the **Week 06** task.

## Features

**Core**
- Search bar to enter a GitHub username
- Fetches user details with `fetch()` from `https://api.github.com/users/<username>`
- Shows profile picture, name, bio and username
- Shows public repositories, followers and following counts
- `useState` manages the input and the fetched data, `useEffect` handles the API call
- Loading message while fetching
- Clear error messages for empty input, invalid usernames, unknown users, rate limiting and network problems
- Responsive layout for desktop and mobile

**Bonus**
- "Visit GitHub Profile" button
- List of the user's public repositories (description, language, stars, forks, last updated)
- Search history (saved in `localStorage`, click a name to search again, clear anytime)
- Dark / light mode toggle (remembers your choice, defaults to your system theme)

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed in the terminal (usually http://localhost:5173).

To create a production build:

```bash
npm run build
npm run preview
```

## Project structure

```
github-profile-finder/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx      # entry point
    ├── App.jsx       # all components and logic
    └── App.css       # styles, light/dark themes, responsive rules
```

## Notes

- The GitHub API allows about 60 unauthenticated requests per hour per IP address. If you hit the limit, the app shows a message; wait a bit and try again.
- Each search makes one request for the profile and, if the user has public repos, one more for the repository list (up to 100 most recently updated).

## Tech stack

React, Vite, plain CSS, GitHub REST API
