"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountService = void 0;
const Account_1 = require("../entities/Account");
const data_source_1 = require("../data-source");
const logger_1 = require("../utils/logger");
class AccountService {
    constructor() {
        this.accountRepository = data_source_1.AppDataSource.getRepository(Account_1.Account);
    }
    async findById(id) {
        return this.accountRepository.findOne({ where: { id } });
    }
    async findByUsername(username) {
        return this.accountRepository.findOne({ where: { username } });
    }
    async getActiveAccounts() {
        return this.accountRepository.find({
            where: { status: Account_1.AccountStatus.ACTIVE },
            order: { lastUsed: 'DESC' }
        });
    }
    async getAvailableAccounts() {
        return this.accountRepository.find({
            where: {
                status: Account_1.AccountStatus.ACTIVE,
                isLoggedIn: false
            },
            order: { lastUsed: 'DESC' }
        });
    }
    async bindAccountToProxy(accountId, proxy, chromeCookies) {
        var _a, _b, _c, _d;
        const account = await this.findById(accountId);
        if (!account)
            throw new Error('Account not found');
        try {
            // Extract required cookies
            const authToken = (_a = chromeCookies.find(c => c.name === 'auth-token')) === null || _a === void 0 ? void 0 : _a.value;
            const login = (_b = chromeCookies.find(c => c.name === 'login')) === null || _b === void 0 ? void 0 : _b.value;
            const persistent = (_c = chromeCookies.find(c => c.name === 'persistent')) === null || _c === void 0 ? void 0 : _c.value;
            const twilightUser = (_d = chromeCookies.find(c => c.name === 'twilight-user')) === null || _d === void 0 ? void 0 : _d.value;
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
            logger_1.logger.info(`Successfully bound account ${account.username} to proxy ${proxy.server}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Error binding account ${account.username} to proxy:`, error);
            return false;
        }
    }
    async setCookiesForPage(page, account) {
        if (account.cookies) {
            await page.setCookie(...account.cookies);
        }
    }
}
exports.AccountService = AccountService;
//# sourceMappingURL=AccountService.js.map