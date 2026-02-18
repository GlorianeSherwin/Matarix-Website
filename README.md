# MatarixWEB
**Course:** 2T-MCSPROJ-IT236  
**School:** NU Fairview

## Team Members
- David Maria Khelly
- Gloriane Sherwin
- Quito Henzo Timothy
- Vilaresis Joshua

Compact overview and setup instructions for the MatarixWEB project.

## Summary
MatarixWEB is a PHP + JS web application with Admin and Customer areas, server APIs, and example/demo copies included under `examples/` and `uploads/`. This repository contains application code, utilities, Composer dependencies, SQL schema, and several duplicated/demo folders.

## Key features
- Admin and Customer frontends
- Server-side APIs (PHP)
- Session, RBAC and DB helpers
- Example/demo copies for testing
- Included third-party modules and Composer packages

## Repository layout (important files/folders)
- `index.html` — project entry (static)
- `connection.php` — database connection (update credentials)
- `u634157906_matarik.sql` — database dump/schema
- `composer.json` / `vendor/` — PHP dependencies
- `Admin/`, `Customer/` — UI pages
- `Admin_assets/`, `Customer_assets/` — JS/CSS for each area
- `api/` — server API endpoints
- `includes/` — core PHP helpers (db, session, rbac)
- `examples/`, `uploads/` — demo/duplicated copies (consider removing before publishing)
- `philippine-address-selector-main/` — bundled third-party module

## Prerequisites
- PHP (project expects PHP >= 7.1 per Composer platform check)
- MySQL / MariaDB
- Composer (if you want vendor packages)
- XAMPP or other local webserver (Windows: XAMPP suggested)

## Local setup (quick)
1. Copy repository to web root (e.g. `C:\xampp\htdocs\MatarixWEB`).
2. Update DB credentials in `connection.php` (do NOT commit production credentials).
3. Import database:
   - Using phpMyAdmin or CLI:
     - phpMyAdmin: Import `u634157906_matarik.sql`
     - CLI: `mysql -u root -p databasename < u634157906_matarik.sql`
4. Install PHP dependencies (optional if vendor/ is present):
   - Open terminal in project root:
     - `composer install`
5. Start Apache & MySQL (XAMPP) and open the site in browser (e.g. `http://localhost/MatarixWEB/`).
6. Verify admin/customer pages and API endpoints; check session/rbac behavior.

## Git & publishing
Recommended .gitignore (do not commit runtime or large artifacts):
- `vendor/`
- `uploads/`
- `examples/`
- `connection.php` (or keep a template like `connection.php.example`)
- IDE and OS files (`.vscode/`, `.DS_Store`, etc.)

Quick Git commands:
```bash
git init
git add .gitignore
git add .
git commit -m "Initial commit"
# create remote and push (example using GitHub CLI)
gh repo create USER/REPO --public --source=. --remote=origin --push
```

## Security & cleanup before publishing
- Remove or exclude `uploads/` and `examples/` duplicates.
- Replace `connection.php` with a template and exclude secrets via `.gitignore`.
- Verify no production credentials are present.
- Ensure server-side RBAC and session checks are enforced on APIs.

## Where to look first (dev entry points)
- `includes/db_functions.php`, `includes/session_helper.php`, `includes/rbac.php`
- Admin notification/auth checks: `Admin_assets/js/*`, `api/get_admin_notifications.php`
- Example/demo pages in `examples/` for quick testing

## Contributing
- Clean duplicates and document canonical folder structure.
- Use feature branches and open PRs.
- Add tests for core API endpoints where feasible.

## License
Specify a license file (e.g., `LICENSE`) if you plan to open-source this project.
```// filepath: c:\xampp\htdocs\MatarixWEB\README.md
...existing code...
# MatarixWEB
**Course:** 2T-MCSPROJ-IT236  
**School:** NU Fairview

## Team Members
- David Maria Khelly
- Gloriane Sherwin
- Quito Henzo Timothy
- Vilaresis Joshua

Compact overview and setup instructions for the MatarixWEB project.

## Summary
MatarixWEB is a PHP + JS web application with Admin and Customer areas, server APIs, and example/demo copies included under `examples/` and `uploads/`. This repository contains application code, utilities, Composer dependencies, SQL schema, and several duplicated/demo folders.

## Key features
- Admin and Customer frontends
- Server-side APIs (PHP)
- Session, RBAC and DB helpers
- Example/demo copies for testing
- Included third-party modules and Composer packages

## Repository layout (important files/folders)
- `index.html` — project entry (static)
- `connection.php` — database connection (update credentials)
- `u634157906_matarik.sql` — database dump/schema
- `composer.json` / `vendor/` — PHP dependencies
- `Admin/`, `Customer/` — UI pages
- `Admin_assets/`, `Customer_assets/` — JS/CSS for each area
- `api/` — server API endpoints
- `includes/` — core PHP helpers (db, session, rbac)
- `examples/`, `uploads/` — demo/duplicated copies (consider removing before publishing)
- `philippine-address-selector-main/` — bundled third-party module

## Prerequisites
- PHP (project expects PHP >= 7.1 per Composer platform check)
- MySQL / MariaDB
- Composer (if you want vendor packages)
- XAMPP or other local webserver (Windows: XAMPP suggested)

## Local setup (quick)
1. Copy repository to web root (e.g. `C:\xampp\htdocs\MatarixWEB`).
2. Update DB credentials in `connection.php` (do NOT commit production credentials).
3. Import database:
   - Using phpMyAdmin or CLI:
     - phpMyAdmin: Import `u634157906_matarik.sql`
     - CLI: `mysql -u root -p databasename < u634157906_matarik.sql`
4. Install PHP dependencies (optional if vendor/ is present):
   - Open terminal in project root:
     - `composer install`
5. Start Apache & MySQL (XAMPP) and open the site in browser (e.g. `http://localhost/MatarixWEB/`).
6. Verify admin/customer pages and API endpoints; check session/rbac behavior.

## Git & publishing
Recommended .gitignore (do not commit runtime or large artifacts):
- `vendor/`
- `uploads/`
- `examples/`
- `connection.php` (or keep a template like `connection.php.example`)
- IDE and OS files (`.vscode/`, `.DS_Store`, etc.)

Quick Git commands:
```bash
git init
git add .gitignore
git add .
git commit -m "Initial commit"
# create remote and push (example using GitHub CLI)
gh repo create USER/REPO --public --source=. --remote=origin --push
```

## Security & cleanup before publishing
- Remove or exclude `uploads/` and `examples/` duplicates.
- Replace `connection.php` with a template and exclude secrets via `.gitignore`.
- Verify no production credentials are present.
- Ensure server-side RBAC and session checks are enforced on APIs.

## Where to look first (dev entry points)
- `includes/db_functions.php`, `includes/session_helper.php`, `includes/rbac.php`
- Admin notification/auth checks: `Admin_assets/js/*`, `api/get_admin_notifications.php`
- Example/demo pages in `examples/` for quick testing

## Contributing
- Clean duplicates and document canonical folder structure.
- Use feature branches and open PRs.
- Add tests for core API endpoints where feasible.

## License
Specify a license file (e.g., `LICENSE`) if you plan to open-source this project.