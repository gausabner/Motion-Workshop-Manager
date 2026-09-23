-- Three changes that belong together: they are all about who may do what.

-- ── Parts & Stock ───────────────────────────────────────────────────────────
-- Products, pricing, suppliers and purchase orders were reachable only by an
-- Owner or an Admin, which meant the person who actually runs the parts counter
-- had to be given settings, the team and the ability to void invoices to do
-- their job. This is the role that was missing under them.
ALTER TYPE "UserGroup" ADD VALUE IF NOT EXISTS 'PARTS_MANAGER' AFTER 'FOREMAN';

-- ── Grants on top of a role ─────────────────────────────────────────────────
-- A workshop where the foreman covers the counter at lunchtime can grant that
-- one person payments, rather than promoting them to Admin and handing over
-- settings, the team and voiding as well. Empty for everyone until an owner
-- decides otherwise, so nothing changes for existing members.
ALTER TABLE "Membership" ADD COLUMN "extraPermissions" TEXT[] NOT NULL DEFAULT '{}';

-- ── Forced password change ──────────────────────────────────────────────────
-- Set whenever somebody else sets the password: an admin creating an account,
-- or issuing a reset. Until it is cleared the account can only reach the screen
-- that changes it. Without this the person who set the password can go on
-- signing in as the owner of the account, and every entry that account leaves
-- in the audit trail becomes deniable — which is most of what an audit trail is
-- for.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
