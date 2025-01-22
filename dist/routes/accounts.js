"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AccountService_1 = require("../services/AccountService");
const ProxyService_1 = require("../services/ProxyService");
const data_source_1 = require("../data-source");
const Account_1 = require("../entities/Account");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const accountRepository = data_source_1.AppDataSource.getRepository(Account_1.Account);
const proxyService = new ProxyService_1.ProxyService();
// Initialize proxy service
(async () => {
    await proxyService.loadProxies();
})();
const accountService = new AccountService_1.AccountService();
// Enable JSON body parsing
router.use((0, express_1.json)());
// List accounts
router.get('/', async (req, res) => {
    try {
        const accounts = await accountRepository.find({
            order: { lastUsed: 'DESC' }
        });
        // Get all available proxies
        const availableProxies = proxyService.getAllProxies();
        const proxyIds = new Set(availableProxies.map(p => p.server));
        // Get all bound proxies
        const boundProxies = new Set(accounts.map(a => a.proxyId).filter(id => id !== null));
        // Find accounts with invalid proxies
        const accountsWithInvalidProxies = accounts.filter(account => account.proxyId !== null && !proxyIds.has(account.proxyId));
        // Get available (unbound) proxies
        const unassignedProxies = availableProxies.filter(proxy => !boundProxies.has(proxy.server));
        res.render('accounts', {
            accounts,
            unassignedProxies,
            accountsWithInvalidProxies
        });
    }
    catch (error) {
        console.error('Error loading accounts:', error);
        res.status(500).send('Error loading accounts');
    }
});
// Toggle account status
router.post('/:id/toggle', async (req, res) => {
    try {
        const account = await accountRepository.findOne({ where: { id: parseInt(req.params.id) } });
        if (!account)
            throw new Error('Account not found');
        account.status = account.status === Account_1.AccountStatus.ACTIVE ? Account_1.AccountStatus.INACTIVE : Account_1.AccountStatus.ACTIVE;
        await accountRepository.save(account);
        res.redirect('/accounts');
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Delete account
router.delete('/:id', async (req, res) => {
    try {
        const account = await accountRepository.findOne({ where: { id: parseInt(req.params.id) } });
        if (!account)
            throw new Error('Account not found');
        await accountRepository.remove(account);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Update account proxy
router.put('/:id/proxy', async (req, res) => {
    try {
        const account = await accountRepository.findOne({ where: { id: parseInt(req.params.id) } });
        if (!account)
            throw new Error('Account not found');
        const { proxyId, cookies } = req.body;
        if (!proxyId || !cookies || !Array.isArray(cookies)) {
            throw new Error('Proxy ID and cookies array are required');
        }
        // Verify required cookies are present
        const requiredCookieNames = ['auth-token', 'login', 'persistent', 'twilight-user'];
        const missingCookies = requiredCookieNames.filter(name => !cookies.some(cookie => cookie.name === name));
        if (missingCookies.length > 0) {
            throw new Error(`Missing required cookies: ${missingCookies.join(', ')}`);
        }
        // Verify proxy exists
        const availableProxies = proxyService.getAllProxies();
        const proxy = availableProxies.find(p => p.server === proxyId);
        if (!proxy) {
            throw new Error('Invalid proxy selected');
        }
        // Bind account to proxy with cookies
        const success = await accountService.bindAccountToProxy(account.id, proxy, cookies);
        if (!success) {
            throw new Error('Failed to bind account to proxy');
        }
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Error updating account proxy:', error);
        res.status(400).json({ error: error.message });
    }
});
// Create account from cookies
router.post('/create-from-cookies', async (req, res) => {
    try {
        const { proxyId, cookies } = req.body;
        if (!proxyId || !cookies || !Array.isArray(cookies)) {
            throw new Error('Proxy ID and cookies array are required');
        }
        // Extract username from cookies
        const loginCookie = cookies.find(c => c.name === 'login');
        if (!loginCookie) {
            throw new Error('Login cookie not found');
        }
        const username = loginCookie.value;
        // Check if account already exists
        const existingAccount = await accountRepository.findOne({ where: { username } });
        if (existingAccount) {
            throw new Error(`Account ${username} already exists`);
        }
        // Verify proxy exists
        const availableProxies = proxyService.getAllProxies();
        const proxy = availableProxies.find(p => p.server === proxyId);
        if (!proxy) {
            throw new Error('Selected proxy not found');
        }
        // Create account with minimal information
        logger_1.logger.info(`Creating account ${username} with proxy ${proxyId}`);
        const account = accountRepository.create({
            username,
            status: Account_1.AccountStatus.ACTIVE,
            proxyId: proxy.server
        });
        await accountRepository.save(account);
        logger_1.logger.info(`Binding account ${username} to proxy with cookies`);
        const success = await accountService.bindAccountToProxy(account.id, proxy, cookies);
        if (!success) {
            // If binding fails, delete the account and return error
            await accountRepository.remove(account);
            throw new Error('Failed to bind account to proxy');
        }
        res.redirect('/accounts');
    }
    catch (error) {
        logger_1.logger.error('Error creating account from cookies:', error);
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=accounts.js.map