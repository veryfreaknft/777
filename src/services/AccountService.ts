import { Account, AccountStatus } from '../entities/Account';
import { AppDataSource } from '../data-source';
import { logger } from '../utils/logger';
import { Page } from 'puppeteer';

export interface ChromeCookie {
  domain: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: string | null;
  secure: boolean;
  session: boolean;
  storeId: string | null;
  value: string;
}

export class AccountService {
  private accountRepository = AppDataSource.getRepository(Account);

  public async findById(id: number): Promise<Account | null> {
    return this.accountRepository.findOne({ where: { id } });
  }

  public async findByUsername(username: string): Promise<Account | null> {
    return this.accountRepository.findOne({ where: { username } });
  }

  public async getActiveAccounts(): Promise<Account[]> {
    return this.accountRepository.find({
      where: { status: AccountStatus.ACTIVE },
      order: { lastUsed: 'DESC' }
    });
  }

  public async getAvailableAccounts(): Promise<Account[]> {
    return this.accountRepository.find({
      where: { 
        status: AccountStatus.ACTIVE,
        isLoggedIn: false
      },
      order: { lastUsed: 'DESC' }
    });
  }

  public async bindAccountToProxy(accountId: number, proxy: any, chromeCookies: ChromeCookie[]): Promise<boolean> {
    const account = await this.findById(accountId);
    if (!account) throw new Error('Account not found');

    try {
      // Extract required cookies
      const authToken = chromeCookies.find(c => c.name === 'auth-token')?.value;
      const login = chromeCookies.find(c => c.name === 'login')?.value;
      const persistent = chromeCookies.find(c => c.name === 'persistent')?.value;
      const twilightUser = chromeCookies.find(c => c.name === 'twilight-user')?.value;

      if (!authToken || !login || !persistent || !twilightUser) {
        throw new Error('Missing required cookies');
      }

      // Parse twilight-user to get display name
      const twilightUserData = JSON.parse(decodeURIComponent(twilightUser));
      const displayName = twilightUserData.displayName;

      // Format cookies for storage
      const formattedCookies = [
        {
          name: 'auth-token',
          value: authToken,
          domain: '.twitch.tv',
          path: '/'
        },
        {
          name: 'login',
          value: login,
          domain: '.twitch.tv',
          path: '/'
        },
        {
          name: 'name',
          value: displayName,
          domain: '.twitch.tv',
          path: '/'
        },
        {
          name: 'persistent',
          value: persistent,
          domain: '.twitch.tv',
          path: '/'
        },
        {
          name: 'twilight-user',
          value: twilightUser,
          domain: '.twitch.tv',
          path: '/'
        }
      ];

      // Save cookies and update account
      account.cookies = formattedCookies;
      account.isLoggedIn = true;
      account.proxyId = proxy.server;
      account.lastUsed = new Date();
      await this.accountRepository.save(account);

      logger.info(`Successfully bound account ${account.username} to proxy ${proxy.server}`);
      return true;
    } catch (error) {
      logger.error(`Error binding account ${account.username} to proxy:`, error);
      return false;
    }
  }

  public async setCookiesForPage(page: Page, account: Account): Promise<void> {
    if (account.cookies) {
      await page.setCookie(...account.cookies);
    }
  }
} 