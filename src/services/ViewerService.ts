import puppeteer from 'puppeteer';
import { ViewerInstance, ViewerStatus, Proxy } from '../types';
import { ProxyService } from './ProxyService';
import { AccountService } from './AccountService';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { AppDataSource } from '../data-source';
import { Account, AccountStatus } from '../entities/Account';
import { ChatMessage } from '../entities/ChatMessage';
import { Buffer } from 'buffer';

export class ViewerService extends EventEmitter {
  private instances: Map<number, ViewerInstance> = new Map();
  private nextInstanceId: number = 1;
  private proxyService: ProxyService;
  private accountService: AccountService;
  private accountRepository = AppDataSource.getRepository(Account);
  private chatMessageRepository = AppDataSource.getRepository(ChatMessage);

  constructor(proxyService: ProxyService, accountService: AccountService) {
    super();
    this.proxyService = proxyService;
    this.accountService = accountService;
  }

  public async createInstance(targetUrl: string, accountId?: number): Promise<ViewerInstance | null> {
    const proxy = await this.proxyService.getAvailableProxy();
    if (!proxy) {
      logger.warn('No available proxies');
      return null;
    }

    try {
      const instance = await this.initializeInstance(targetUrl, proxy);
      
      if (accountId) {
        const account = await this.accountRepository.findOne({ where: { id: accountId } });
        if (account && account.status === AccountStatus.ACTIVE) {
          instance.account = {
            id: account.id,
            username: account.username,
            isLoggedIn: false
          };
          await this.loginAccount(instance);
        }
      }

      this.instances.set(instance.id, instance);
      this.emit('instanceCreated', {
        id: instance.id,
        status: instance.status
      });
      this.emit('statsUpdated', this.getStats());
      return instance;
    } catch (error) {
      logger.error('Error creating instance:', error);
      this.proxyService.releaseProxy(proxy);
      return null;
    }
  }

  private async loginAccount(instance: ViewerInstance): Promise<void> {
    if (!instance.account || !instance.page) return;

    try {
      instance.status = ViewerStatus.LOGIN_PENDING;
      instance.account.lastLoginAttempt = new Date();
      
      // Get account details
      const account = await this.accountRepository.findOne({ where: { id: instance.account.id } });
      if (!account) throw new Error('Account not found');

      // If account has cookies, use them for login
      if (account.cookies) {
        await this.accountService.setCookiesForPage(instance.page, account);
        instance.account.isLoggedIn = true;
        instance.status = ViewerStatus.INITIALIZED;
        
        // Update account status in database
        account.isLoggedIn = true;
        account.lastUsed = new Date();
        await this.accountRepository.save(account);

        // Navigate to target
        await instance.page.goto(instance.targetUrl, { waitUntil: 'networkidle0' });
      } else {
        // No cookies available, continue in view-only mode
        instance.status = ViewerStatus.INITIALIZED;
        logger.info(`No cookies available for account ${account.username}, continuing in view-only mode`);
        await instance.page.goto(instance.targetUrl, { waitUntil: 'networkidle0' });
      }
    } catch (error: any) {
      instance.status = ViewerStatus.LOGIN_FAILED;
      instance.account.loginError = error.message;
      logger.error(`Login error for account ${instance.account.username}:`, error);
    }

    this.emit('instanceUpdated', {
      id: instance.id,
      status: instance.status
    });
  }

  private async initializeInstance(targetUrl: string, proxy: Proxy): Promise<ViewerInstance> {
    const instance: ViewerInstance = {
      id: this.nextInstanceId++,
      proxy,
      status: ViewerStatus.STARTING,
      targetUrl,
      lastActive: new Date()
    };

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          `--proxy-server=${proxy.server}`,
          '--window-size=800,600',
          '--mute-audio'
        ]
      });

      const page = await browser.newPage();
      
      if (proxy.username && proxy.password) {
        await page.authenticate({
          username: proxy.username,
          password: proxy.password
        });
      }

      // Configure viewport and user agent
      await page.setViewport({ width: 800, height: 600 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');

      // Inject scripts to prevent detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      instance.browser = browser;
      instance.page = page;

      // If account is associated, set cookies
      if (instance.account) {
        const account = await this.accountRepository.findOne({ where: { id: instance.account.id } });
        if (account?.cookies) {
          await page.setCookie(...account.cookies);
          instance.account.isLoggedIn = true;
        }
      }

      // Navigate to Twitch
      await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Accept cookies if present
      function delay(time: number) {
        return new Promise(resolve => setTimeout(resolve, time));
      }

      try {
        const cookieButton = await page.$('[data-a-target="consent-banner-accept"]');
        if (cookieButton) {
          await cookieButton.click();
          await delay(1000); // Usa la función personalizada delay en lugar de waitForTimeout
        }
      } catch (e) {
        logger.warn('Could not find or click cookie banner');
      }

      // Set quality to 160p
      await page.evaluate(() => {
        try {
          localStorage.setItem('video-quality', '{"default":"160p30"}');
          localStorage.setItem('volume', '0');
          localStorage.setItem('mature', 'true');
        } catch (e) {
          console.warn('Could not set localStorage values');
        }
      });

      // Wait for video player
      try {
        await page.waitForSelector('video', { timeout: 10000 });
        instance.status = ViewerStatus.WATCHING;
      } catch (e) {
        instance.status = ViewerStatus.INITIALIZED;
        logger.warn('Could not find video player');
      }

      // Start monitoring the instance
      this.monitorInstance(instance);
      
      return instance;
    } catch (error) {
      logger.error(`Error initializing instance ${instance.id}:`, error);
      throw error;
    }
  }

  private async monitorInstance(instance: ViewerInstance): Promise<void> {
    const checkInterval = setInterval(async () => {
      try {
        if (!instance.page) {
          clearInterval(checkInterval);
          return;
        }

        const isPlaying = await instance.page.evaluate(() => {
          const video = document.querySelector('video');
          return video ? !video.paused && video.readyState === 4 : false;
        });

        // Check chat status if logged in
        if (instance.account?.isLoggedIn) {
          const chatEnabled = await instance.page.evaluate(() => {
            return document.querySelector('[data-a-target="chat-input"]') !== null;
          });
          
          if (chatEnabled && instance.status !== ViewerStatus.CHAT_ENABLED) {
            instance.status = ViewerStatus.CHAT_ENABLED;
          }
        }

        const oldStatus = instance.status;
        if (instance.status !== ViewerStatus.CHAT_ENABLED) {
          instance.status = isPlaying ? ViewerStatus.WATCHING : ViewerStatus.INITIALIZED;
        }
        instance.lastActive = new Date();
        
        if (oldStatus !== instance.status) {
          this.emit('instanceUpdated', {
            id: instance.id,
            status: instance.status
          });
          this.emit('statsUpdated', this.getStats());
        }

        // Take screenshot if needed
        if (this.listenerCount('screenshotRequested') > 0) {
          const screenshot = await instance.page.screenshot();
          instance.lastScreenshot = Buffer.from(screenshot);
          this.emit('screenshotTaken', instance.id, instance.lastScreenshot);
        }
      } catch (error: any) {
        logger.error(`Error monitoring instance ${instance.id}:`, error);
        await this.stopInstance(instance.id);
        clearInterval(checkInterval);
      }
    }, 5000);
  }

  public async stopInstance(instanceId: number): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    try {
      if (instance.account) {
        const account = await this.accountRepository.findOne({ where: { id: instance.account.id } });
        if (account) {
          account.isLoggedIn = false;
          await this.accountRepository.save(account);
        }
      }

      if (instance.page) await instance.page.close();
      if (instance.browser) await instance.browser.close();
      this.proxyService.releaseProxy(instance.proxy);
      instance.status = ViewerStatus.STOPPED;
      this.instances.delete(instanceId);
      this.emit('instanceStopped', { id: instanceId });
      this.emit('statsUpdated', this.getStats());
    } catch (error) {
      logger.error(`Error stopping instance ${instanceId}:`, error);
    }
  }

  public async stopAllInstances(): Promise<void> {
    const promises = Array.from(this.instances.keys()).map(id => this.stopInstance(id));
    await Promise.all(promises);
  }

  public getStats() {
    const instances = Array.from(this.instances.values());
    return {
      totalViewers: instances.length,
      activeViewers: instances.filter(i => i.status !== ViewerStatus.STOPPED).length,
      watchingViewers: instances.filter(i => i.status === ViewerStatus.WATCHING).length,
      loggedInViewers: instances.filter(i => i.account?.isLoggedIn).length,
      chatEnabledViewers: instances.filter(i => i.status === ViewerStatus.CHAT_ENABLED).length
    };
  }

  public async requestScreenshot(instanceId: number): Promise<Buffer | null> {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.page) return null;

    try {
      const screenshot = await instance.page.screenshot();
      instance.lastScreenshot = Buffer.from(screenshot);
      return Buffer.from(screenshot);
    } catch (error) {
      logger.error(`Error taking screenshot for instance ${instanceId}:`, error);
      return null;
    }
  }

  public async sendChatMessage(instanceId: number, message: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.page || !instance.account?.isLoggedIn) return false;

    try {
      // Click chat input
      await instance.page.click('[data-a-target="chat-input"]');
      
      // Type and send message
      await instance.page.keyboard.type(message);
      await instance.page.keyboard.press('Enter');
      
      instance.lastChatMessage = new Date();
      
      // Save message to database
      const chatMessage = this.chatMessageRepository.create({
        account: { id: instance.account.id },
        channelName: new URL(instance.targetUrl).pathname.slice(1),
        message,
        sentAt: new Date(),
        isAiGenerated: false
      });
      await this.chatMessageRepository.save(chatMessage);
      
      return true;
    } catch (error: any) {
      logger.error(`Error sending chat message for instance ${instanceId}:`, error);
      return false;
    }
  }

  public async followChannel(instanceId: number): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.page || !instance.account?.isLoggedIn) return false;

    try {
      // Check if already following
      const isFollowing = await instance.page.evaluate(() => {
        const followButton = document.querySelector('[data-a-target="follow-button"]');
        return followButton === null || followButton.textContent?.includes('Unfollow');
      });

      if (isFollowing) {
        instance.isFollowing = true;
        return true;
      }

      // Click follow button
      await instance.page.click('[data-a-target="follow-button"]');
      
      // Wait for follow confirmation
      await instance.page.waitForFunction(() => {
        const followButton = document.querySelector('[data-a-target="follow-button"]');
        return followButton?.textContent?.includes('Unfollow');
      }, { timeout: 5000 });

      instance.isFollowing = true;
      return true;
    } catch (error: any) {
      logger.error(`Error following channel for instance ${instanceId}:`, error);
      return false;
    }
  }
}