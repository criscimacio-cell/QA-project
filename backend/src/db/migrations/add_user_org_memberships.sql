-- Allow users to belong to multiple orgs via a memberships table
CREATE TABLE IF NOT EXISTS user_org_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Migrate existing users into memberships table
INSERT INTO user_org_memberships (user_id, organization_id, role, active)
SELECT id, organization_id, role, active FROM users
ON CONFLICT (user_id, organization_id) DO NOTHING;
