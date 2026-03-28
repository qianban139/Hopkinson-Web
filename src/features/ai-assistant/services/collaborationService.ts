// src/features/ai-assistant/services/collaborationService.ts
// 协作模式 - 多用户身份识别、会话共享

const COLLAB_STORAGE_KEY = 'hopkinson_ai_collab';

export interface UserProfile {
  id: string;
  name: string;
  role: 'operator' | 'researcher' | 'student' | 'admin';
  avatar?: string;       // 可选头像URL或emoji
  createdAt: number;
  lastActive: number;
  preferences: Record<string, string>;
}

export interface SharedSession {
  id: string;
  name: string;
  createdBy: string;     // user id
  participants: string[]; // user ids
  createdAt: number;
  isActive: boolean;
}

interface CollabState {
  currentUserId: string | null;
  users: UserProfile[];
  sessions: SharedSession[];
}

function loadState(): CollabState {
  try {
    const saved = localStorage.getItem(COLLAB_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.users && Array.isArray(parsed.users)) return parsed;
    }
  } catch {}
  return { currentUserId: null, users: [], sessions: [] };
}

function saveState(state: CollabState): void {
  try {
    localStorage.setItem(COLLAB_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// ═══ 用户管理 ═══

/** 创建新用户 */
export function createUser(name: string, role: UserProfile['role'] = 'operator'): UserProfile {
  const state = loadState();
  const user: UserProfile = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    role,
    createdAt: Date.now(),
    lastActive: Date.now(),
    preferences: {},
  };
  state.users.push(user);
  state.currentUserId = user.id;
  saveState(state);
  return user;
}

/** 切换当前用户 */
export function switchUser(userId: string): boolean {
  const state = loadState();
  const user = state.users.find(u => u.id === userId);
  if (!user) return false;
  user.lastActive = Date.now();
  state.currentUserId = userId;
  saveState(state);
  return true;
}

/** 获取当前用户 */
export function getCurrentUser(): UserProfile | null {
  const state = loadState();
  if (!state.currentUserId) return null;
  return state.users.find(u => u.id === state.currentUserId) || null;
}

/** 获取所有用户 */
export function getAllUsers(): UserProfile[] {
  return loadState().users;
}

/** 更新用户信息 */
export function updateUser(userId: string, updates: Partial<Pick<UserProfile, 'name' | 'role' | 'avatar'>>): boolean {
  const state = loadState();
  const user = state.users.find(u => u.id === userId);
  if (!user) return false;
  Object.assign(user, updates);
  saveState(state);
  return true;
}

/** 删除用户 */
export function deleteUser(userId: string): boolean {
  const state = loadState();
  state.users = state.users.filter(u => u.id !== userId);
  if (state.currentUserId === userId) state.currentUserId = state.users[0]?.id || null;
  // 清理关联会话
  state.sessions.forEach(s => {
    s.participants = s.participants.filter(id => id !== userId);
  });
  saveState(state);
  return true;
}

/** 设置用户偏好 */
export function setUserPreference(key: string, value: string): void {
  const state = loadState();
  const user = state.users.find(u => u.id === state.currentUserId);
  if (!user) return;
  user.preferences[key] = value;
  saveState(state);
}

/** 获取用户偏好 */
export function getUserPreference(key: string): string | null {
  const user = getCurrentUser();
  return user?.preferences[key] || null;
}

// ═══ 会话共享 ═══

/** 创建共享会话 */
export function createSharedSession(name: string): SharedSession | null {
  const state = loadState();
  if (!state.currentUserId) return null;

  const session: SharedSession = {
    id: `session_${Date.now()}`,
    name,
    createdBy: state.currentUserId,
    participants: [state.currentUserId],
    createdAt: Date.now(),
    isActive: true,
  };
  state.sessions.push(session);
  saveState(state);
  return session;
}

/** 加入共享会话 */
export function joinSession(sessionId: string): boolean {
  const state = loadState();
  if (!state.currentUserId) return false;
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session || !session.isActive) return false;
  if (!session.participants.includes(state.currentUserId)) {
    session.participants.push(state.currentUserId);
  }
  saveState(state);
  return true;
}

/** 获取活跃会话列表 */
export function getActiveSessions(): SharedSession[] {
  return loadState().sessions.filter(s => s.isActive);
}

/** 结束共享会话 */
export function endSession(sessionId: string): boolean {
  const state = loadState();
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return false;
  session.isActive = false;
  saveState(state);
  return true;
}

// ═══ 上下文注入 ═══

/** 生成用户上下文摘要（注入到AI System Prompt） */
export function getUserContextSummary(): string {
  const user = getCurrentUser();
  if (!user) return '';

  const roleLabels: Record<UserProfile['role'], string> = {
    operator: '实验操作员',
    researcher: '科研人员',
    student: '学生',
    admin: '管理员',
  };

  const lines: string[] = [
    `\n当前用户: ${user.name} (${roleLabels[user.role]})`,
  ];

  // 添加用户偏好
  const prefEntries = Object.entries(user.preferences);
  if (prefEntries.length > 0) {
    lines.push('用户偏好:');
    for (const [key, value] of prefEntries.slice(-5)) {
      lines.push(`  - ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

/** 根据用户角色获取差异化的助手行为提示 */
export function getRoleBehaviorPrompt(): string {
  const user = getCurrentUser();
  if (!user) return '';

  switch (user.role) {
    case 'student':
      return '\n用户是学生，回答时请多解释原理，使用通俗易懂的语言，鼓励提问。';
    case 'researcher':
      return '\n用户是科研人员，可以使用专业术语，提供更详细的数据分析和文献参考。';
    case 'admin':
      return '\n用户是管理员，可以讨论系统配置、维护和高级操作。';
    case 'operator':
    default:
      return '\n用户是实验操作员，重点关注操作步骤和安全事项。';
  }
}
