# Home Redirect

**Page Path:** `/`

## 1. Page Overview
- **Page name:** Home Redirect
- **Purpose:** provide a stable application entry point and send the user to the primary dashboard.
- **User outcome:** the user lands on `/cyber-cop` without interacting with a landing page.
- **Primary user roles:** all users entering the application through the root URL.

## 2. Page Summary
The route does not render UI. It immediately executes a server-side redirect to `/cyber-cop`.

Dependencies:

- Next.js `redirect()`
- `/cyber-cop`

## 3. Feature Breakdown
### Feature: Root Route Redirect
- **What it does:** redirects the root route to the Cyber COP dashboard.
- **User perspective:** browsing to `/` opens the Cyber COP page instead of a standalone home screen.
- **System behaviour:** the server component executes `redirect("/cyber-cop")` before rendering.
- **Outcome:** a single canonical landing page is enforced.
- **Rules / validations / error handling:** there is no conditional logic, filter preservation, or fallback path.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home Redirect | Root redirect | Redirects `/` to `/cyber-cop` | Open `/` | Executes `redirect("/cyber-cop")` in the server component | HTTP request to `/` | HTTP redirect response | Root URL always lands on Cyber COP | none | Next.js routing, `/cyber-cop` page | User reaches dashboard | Query parameters are not preserved |

## 5. Database Mapping
This route does not read or write application data. It performs no database access and does not resolve filters, snapshots, or settings.

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home Redirect | Root redirect | N/A | N/A | N/A | N/A | No persisted data used | None | None | Always redirect | None | No DB interaction |

## 7. Calculations and Derived Logic
No calculations are performed.

## 8. Non-Database Calculations
No runtime calculations are performed.

## 9. Rules, Assumptions, and Constraints
- The route is intentionally non-interactive.
- The redirect target is hard-coded to `/cyber-cop`.
- Any query string supplied to `/` is discarded because the redirect target is fixed.

## 10. Open Questions / Gaps
- **Open question:** should `dataDate` or other incoming query parameters be preserved when entering via `/`?
- **Needed to resolve:** product or UX decision for canonical landing-page parameter handling.
