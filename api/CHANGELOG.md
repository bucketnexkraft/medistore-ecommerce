# Changelog

All notable changes to stoqio are documented in this file.

The format follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses calendar dates for release notes.

## [Unreleased]

### Added

- Product-specific project documentation in `README.md`.
- Installation and configuration guidance for the Laravel API and React/Vite frontend.
- Feature overview covering inventory, POS, purchasing, stock, SaaS backoffice, reporting, content, localization, and maintenance modules.
- Deployment and maintenance checklist for production environments.
- README notes for the included `robin/` companion Laravel application and the current absence of standalone native mobile app projects in this checkout.
- Authentication-specific API rate limiting for login, company registration, password reset, token verification, route access, profile, password change, current user, rights, and logout endpoints.

### Changed

- Pinned TailwindCSS to stable `3.4.19` in the React frontend to avoid accidental compatibility drift.

### Notes

- Update this section as changes are merged, then move entries into a dated release section when a version is published.

## [1.0.0] - 2026-06-10

### Added

- Initial documented baseline for stoqio.
- Laravel 12 API backend with versioned `/api/v1` routes.
- React 18 and Vite frontend under `frontend-source`.
- Authentication, role and rights management, notifications, profile, and password flows.
- Inventory catalog modules for products, variants, bundles, categories, brands, units, barcodes, and custom values.
- Purchasing, supplier, purchase return, invoice, and stock intake workflows.
- Sales, POS, drafts, returns, installment payment, coupon or gift card verification, discount, reward, and waitlist workflows.
- Warehouse, stock movement, stock transfer, stock overview, stock out, and StockGuard workflows.
- Reporting endpoints for sales, purchases, stock, accounting, profit margin, product ledger, timesheet, and sales returns.
- SaaS backoffice modules for companies, plans, gateways, currencies, payment logs, feature preferences, company rights, and admin settings.
- Content management for landing pages, menus, pages, blogs, contact messages, newsletters, and localization files.
- Operational tooling for audit logs, log viewing, backups, backup cleanup, and Google Drive backup configuration.

### Notes

- This release entry represents the current repository baseline at the time product documentation was added.
