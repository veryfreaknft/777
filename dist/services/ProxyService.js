"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyService = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = require("../utils/logger");
const data_source_1 = require("../data-source");
const Account_1 = require("../entities/Account");
const typeorm_1 = require("typeorm");
class ProxyService {
    constructor() {
        this.proxies = [];
        this.inUseProxies = new Set();
        this.accountRepository = data_source_1.AppDataSource.getRepository(Account_1.Account);
    }
    async loadProxies() {
        try {
            const content = (0, fs_1.readFileSync)((0, path_1.join)(process.cwd(), 'proxy_list.txt'), 'utf-8');
            this.proxies = content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
                .map(line => {
                const [ip, port, username, password] = line.split(':');
                const server = `http://${ip}:${port}`;
                return { server, username, password, inUse: false };
            });
            logger_1.logger.info(`Loaded ${this.proxies.length} proxies`);
        }
        catch (error) {
            logger_1.logger.error('Error loading proxies:', error);
            this.proxies = [];
        }
    }
    getAllProxies() {
        return [...this.proxies];
    }
    async getAvailableProxy() {
        // Get all proxies with accounts
        const accountProxies = await this.accountRepository.find({
            where: { proxyId: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()) },
            select: ['proxyId']
        });
        const proxyIdsWithAccounts = new Set(accountProxies.map(a => a.proxyId));
        // First try to find an available proxy with account
        const proxyWithAccount = this.proxies.find(proxy => !this.inUseProxies.has(proxy.server) &&
            proxyIdsWithAccounts.has(proxy.server));
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
    releaseProxy(proxy) {
        this.inUseProxies.delete(proxy.server);
    }
    getProxyStats() {
        return {
            total: this.proxies.length,
            available: this.proxies.length - this.inUseProxies.size,
            inUse: this.inUseProxies.size
        };
    }
}
exports.ProxyService = ProxyService;
//# sourceMappingURL=ProxyService.js.map