# Snap Clone

A full-stack Snapchat clone built with Node.js, Express, and SQLite/PostgreSQL.

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- PostgreSQL (if using PostgreSQL instead of SQLite)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the database configuration as needed

## Development

To start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Deployment

### Vercel/Netlify

1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` and follow the prompts
3. Set up environment variables in the Vercel/Netlify dashboard

### VPS Deployment

1. Install Node.js, npm, and PostgreSQL on your server
2. Clone the repository
3. Install dependencies: `npm install --production`
4. Set up environment variables in `.env`
5. Start the server: `node server.js`

## Environment Variables

Create a `.env` file with the following variables:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/dbname
SESSION_SECRET=your-session-secret
```

## Database

### SQLite (Development)
The app uses SQLite by default for development.

### PostgreSQL (Production)
To use PostgreSQL in production:
1. Set up a PostgreSQL database
2. Update the `DATABASE_URL` in `.env`
3. Run migrations: `node run-migration.js`

## License

MIT
