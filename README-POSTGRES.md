# Snapchat Clone with PostgreSQL

This is a Snapchat-style web application that has been updated to use PostgreSQL as its database backend.

## Prerequisites

1. Node.js (v14 or later)
2. PostgreSQL (v12 or later)
3. npm or yarn

## Setup Instructions

### 1. Install Dependencies

Run the following command to install all required dependencies:

```bash
npm install
```

### 2. Database Setup

1. Create a new PostgreSQL database named `snapchat_style_app` (or any name you prefer)
2. Update the `.env` file with your PostgreSQL credentials:

```env
# PostgreSQL Configuration
PG_USER=your_postgres_username
PG_HOST=localhost
PG_DATABASE=snapchat_style_app
PG_PASSWORD=your_postgres_password
PG_PORT=5432

# Server configuration
PORT=3000

# JWT Secret (for authentication)
JWT_SECRET=your_jwt_secret_here

# Environment
NODE_ENV=development

# File uploads
UPLOAD_DIR=./public/uploads
```

### 3. Database Schema

Run the SQL script from `database/schema.sql` in your PostgreSQL database to create the required tables and relationships.

### 4. Start the Application

To start the application in development mode with auto-reload:

```bash
npm run dev
```

Or in production mode:

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

- `server-pg.js` - Main application entry point with Express server and routes
- `db-pg.js` - PostgreSQL database connection and queries
- `public/` - Frontend static files (HTML, CSS, JavaScript)
- `public/uploads/` - Directory where uploaded images are stored
- `.env` - Environment variables and configuration

## API Endpoints

- `POST /api/snaps` - Upload a new snap
- `GET /api/feed` - Get paginated feed of snaps
- `GET /api/snaps/:id` - Get a specific snap by ID

## Development

### Running Migrations

To run database migrations:

```bash
npm run migrate
```

### Environment Variables

- `NODE_ENV` - Set to 'development' or 'production'
- `PORT` - Port number for the server (default: 3000)
- `PG_*` - PostgreSQL connection settings
- `JWT_SECRET` - Secret key for JWT authentication
- `UPLOAD_DIR` - Directory for file uploads

## Troubleshooting

### Database Connection Issues

1. Ensure PostgreSQL is running
2. Verify database credentials in `.env`
3. Check if the database exists and is accessible

### File Uploads

- Ensure the `public/uploads` directory exists and is writable
- Check file size limits in `server-pg.js` (default: 10MB)

## License

MIT
