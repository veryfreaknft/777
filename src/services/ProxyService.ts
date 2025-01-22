import { readFileSync } from 'fs';
import { join } from 'path';
import { Proxy } from '../types';
import { logger } from '../utils/logger';
import { AppDataSource } from '../data-source';
import { Account } from '../entities/Account';
import { Not, IsNull } from 'typeorm';

export class ProxyService {
  private proxies: Proxy[] = [];
  private inUseProxies: Set<string> = new Set();
  private accountRepository = AppDataSource.getRepository(Account);

  public async loadProxies(): Promise<void> {
    try {
      const content = readFileSync(join(process.cwd(), 'proxy_list.txt'), 'utf-8');
      this.proxies = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const [ip, port, username, password] = line.split(':');
          const server = `http://${ip}:${port}`;
          return { server, username, password, inUse: false };
        });
      logger.info(`Loaded ${this.proxies.length} proxies`);
    } catch (error) {
      logger.error('Error loading proxies:', error);
      this.proxies = [];
    }
  }

  public getAllProxies(): Proxy[] {
    return [...this.proxies];
  }

  public async getAvailableProxy(): Promise<Proxy | null> {
    // Get all proxies with accounts
    const accountProxies = await this.accountRepository.find({
      where: { proxyId: Not(IsNull()) },
      select: ['proxyId']
    });
    const proxyIdsWithAccounts = new Set(accountProxies.map(a => a.proxyId));

    // First try to find an available proxy with account
    const proxyWithAccount = this.proxies.find(proxy => 
      !this.inUseProxies.has(proxy.server) && 
      proxyIdsWithAccounts.has(proxy.server)
    );

    if (proxyWithAccount) {
      this.inUseProxies.add(proxyWithAccount.server);
      return proxyWithAccount;
    }

    // If no proxy with account is available, use any available proxy
    const availableProxy = this.proxies.find(proxy => !this.inUseProxies.has(proxy.server));
    if (availableProxy) {
      this.inUseProxies.add(availableProxy.server);
      return availableProxy;
    }

    return null;
  }

  public releaseProxy(proxy: Proxy): void {
    this.inUseProxies.delete(proxy.server);
  }

  public getProxyStats() {
    return {
      total: this.proxies.length,
      available: this.proxies.length - this.inUseProxies.size,
      inUse: this.inUseProxies.size
    };
  }
} 