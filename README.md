# mailamod

A Next.js to-do app with grouped tasks, SQLite storage, and Google Calendar import.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Configure local database

The app stores data in a SQLite file (`todo.db`). By default it is created inside a `data/` folder in the project directory, but this folder is git-ignored and will be recreated empty each time — so it is recommended to point it to a stable location outside the repo.

1. Create a folder anywhere on your machine to hold the database, e.g.:
   - **Windows:** `C:\Users\<YourName>\project\Code\data`
   - **macOS/Linux:** `~/data/mailamod`

2. Create a `.env.local` file in the project root (it is already git-ignored):

   ```env
   TODO_DATA_DIR=/absolute/path/to/your/data/folder
   ```

   Windows example:
   ```env
   TODO_DATA_DIR=C:/Users/YourName/project/Code/data
   ```

   If `TODO_DATA_DIR` is not set, the app falls back to `<project-root>/data/todo.db`.

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
