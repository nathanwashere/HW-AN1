# Authentication Assignment

Small localhost web application for the Data Security class work.

## What It Does

- Login with separate `username` and `password` fields.
- Passwords are stored in PostgreSQL only as SHA-256 hashes.
- The first seeded user is the admin user.
- Admin and standard users are differentiated by role.
- "Forgot password?" creates a reset link and does not reveal the old password.
- Reset tokens are stored hashed as well.

## Database

The app uses these PostgreSQL defaults:

- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Database: `alon`
- Password: `130520`

You can override them with standard environment variables: `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`.

## Run

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Default Admin Account

- Username: `admin`
- Password: `Admin123!`

## Default Standard User

- Username: `student`
- Password: `User12345!`

Change both passwords after the first login.

## Files

- `server.js`: thin startup file
- `src/app.js`: route handling and request flow
- `src/config.js`: app and database configuration
- `src/db/`: PostgreSQL access and initialization
- `src/lib/`: HTTP and security helpers
- `src/views/pages.js`: HTML rendering
- `sql/schema.sql`: PostgreSQL tables
- `public/style.css`: page styling
- `submission.txt`: Moodle submission text template
