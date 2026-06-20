export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'lead' | 'engineer' | 'viewer';
  department: string;
  avatar: string;
  active: number;
  created_at: string;
  last_login: string;
}

export interface Repository {
  id: number;
  name: string;
  description: string;
  parent_id: number | null;
  type: 'folder' | 'repo';
  project: string;
  owner_id: number;
  created_at: string;
}

export interface FileRecord {
  id: number;
  name: string;
  original_name: string;
  path: string;
  size: number;
  mime_type: string;
  repository_id: number;
  owner_id: number;
  version: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'published' | 'archived';
  project: string;
  module: string;
  category: string;
  jira_ticket: string;
  tags: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  organizationId: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
