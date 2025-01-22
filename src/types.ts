import { Browser, Page } from 'puppeteer';

export interface Proxy {
  server: string;
  username?: string;
  password?: string;
  inUse: boolean;
}

export enum ViewerStatus {
  STARTING = 'starting',
  INITIALIZED = 'initialized',
  LOGIN_PENDING = 'login_pending',
  LOGIN_FAILED = 'login_failed',
  WATCHING = 'watching',
  CHAT_ENABLED = 'chat_enabled',
  STOPPED = 'stopped'
}

export interface ViewerInstance {
  id: number;
  browser?: Browser;
  page?: Page;
  proxy: Proxy;
  status: ViewerStatus;
  targetUrl: string;
  lastActive: Date;
  lastScreenshot?: Buffer;
  lastChatMessage?: Date;
  isFollowing?: boolean;
  account?: {
    id: number;
    username: string;
    isLoggedIn: boolean;
    lastLoginAttempt?: Date;
    loginError?: string;
  };
} 