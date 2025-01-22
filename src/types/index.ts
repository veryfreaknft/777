export interface Proxy {
  server: string;
  username?: string;
  password?: string;
  inUse: boolean;
  lastUsed?: Date;
}

export interface ViewerInstance {
  id: number;
  proxy: Proxy;
  status: ViewerStatus;
  targetUrl: string;
  browser?: any; // Puppeteer Browser instance
  page?: any;    // Puppeteer Page instance
  lastScreenshot?: Buffer;
  lastActive: Date;
  account?: {
    id: number;
    username: string;
    isLoggedIn: boolean;
    lastLoginAttempt?: Date;
    loginError?: string;
  };
  lastChatMessage?: Date;
  isFollowing?: boolean;
}

export enum ViewerStatus {
  STARTING = 'starting',
  INITIALIZED = 'initialized',
  WATCHING = 'watching',
  ERROR = 'error',
  STOPPED = 'stopped',
  LOGIN_PENDING = 'login_pending',
  LOGIN_FAILED = 'login_failed',
  CHAT_ENABLED = 'chat_enabled'
}

export interface ViewerStats {
  totalViewers: number;
  activeViewers: number;
  watchingViewers: number;
  availableProxies: number;
  cpuUsage: number;
  memoryUsage: number;
  loggedInViewers?: number;
  chatEnabledViewers?: number;
} 