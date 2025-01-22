"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const ProxyService_1 = require("./services/ProxyService");
const ViewerService_1 = require("./services/ViewerService");
const AccountService_1 = require("./services/AccountService");
const logger_1 = require("./utils/logger");
const data_source_1 = require("./data-source");
const Account_1 = require("./entities/Account");
const ChatTemplate_1 = require("./entities/ChatTemplate");
const accounts_1 = __importDefault(require("./routes/accounts"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer);
// Services
const proxyService = new ProxyService_1.ProxyService();
const accountService = new AccountService_1.AccountService();
const viewerService = new ViewerService_1.ViewerService(proxyService, accountService);
const accountRepository = data_source_1.AppDataSource.getRepository(Account_1.Account);
const templateRepository = data_source_1.AppDataSource.getRepository(ChatTemplate_1.ChatTemplate);
// Express configuration
app.set('view engine', 'ejs');
app.set('views', path_1.default.join(__dirname, 'views'));
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
app.use(express_1.default.json());
// Routes
app.use('/accounts', accounts_1.default);
app.get('/', (req, res) => {
    const stats = viewerService.getStats();
    const proxyStats = proxyService.getProxyStats();
    res.render('index', { stats, proxyStats });
});
// Chat Template Routes
app.get('/chat', async (req, res) => {
    const templates = await templateRepository.find({
        order: { id: 'DESC' }
    });
    res.render('chat', { templates });
});
app.post('/chat/templates', async (req, res) => {
    try {
        const { message, type, minDelay, maxDelay, enabled, aiConfig } = req.body;
        const template = templateRepository.create({
            message,
            type: type,
            minDelay: parseInt(minDelay),
            maxDelay: parseInt(maxDelay),
            enabled: enabled === 'true',
            aiConfig: type === 'ai_generated' ? aiConfig : null
        });
        await templateRepository.save(template);
        res.redirect('/chat');
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
app.get('/chat/templates/:id', async (req, res) => {
    try {
        const template = await templateRepository.findOne({ where: { id: parseInt(req.params.id) } });
        if (!template)
            throw new Error('Template not found');
        res.json(template);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
app.put('/chat/templates/:id', async (req, res) => {
    try {
        const template = await templateRepository.findOne({ where: { id: parseInt(req.params.id) } });
        if (!template)
            throw new Error('Template not found');
        Object.assign(template, req.body);
        await templateRepository.save(template);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
app.post('/chat/templates/:id/toggle', async (req, res) => {
    try {
        const template = await templateRepository.findOne({ where: { id: parseInt(req.params.id) } });
        if (!template)
            throw new Error('Template not found');
        template.enabled = !template.enabled;
        await templateRepository.save(template);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
app.delete('/chat/templates/:id', async (req, res) => {
    try {
        const template = await templateRepository.findOne({ where: { id: parseInt(req.params.id) } });
        if (!template)
            throw new Error('Template not found');
        await templateRepository.remove(template);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// WebSocket events
io.on('connection', (socket) => {
    logger_1.logger.info('Client connected');
    // Send initial stats
    socket.emit('stats', {
        ...viewerService.getStats(),
        ...proxyService.getProxyStats()
    });
    // Handle viewer creation
    socket.on('createViewer', async (data) => {
        const instance = await viewerService.createInstance(data.targetUrl, data.accountId);
        if (!instance) {
            socket.emit('error', { message: 'Failed to create viewer' });
        }
    });
    // Handle viewer stop request
    socket.on('stopViewer', async (data) => {
        await viewerService.stopInstance(data.id);
    });
    // Handle screenshot request
    socket.on('requestScreenshot', async (data) => {
        const screenshot = await viewerService.requestScreenshot(data.id);
        if (screenshot) {
            socket.emit('screenshot', {
                id: data.id,
                image: screenshot.toString('base64')
            });
        }
    });
    // Handle chat message
    socket.on('sendChatMessage', async (data) => {
        const success = await viewerService.sendChatMessage(data.id, data.message);
        socket.emit('chatMessageResult', {
            id: data.id,
            success,
            message: success ? 'Message sent' : 'Failed to send message'
        });
    });
    // Handle follow request
    socket.on('followChannel', async (data) => {
        const success = await viewerService.followChannel(data.id);
        socket.emit('followResult', {
            id: data.id,
            success,
            message: success ? 'Now following channel' : 'Failed to follow channel'
        });
    });
    // Get available accounts
    socket.on('getAccounts', async () => {
        const accounts = await accountRepository.find({
            select: ['id', 'username', 'status', 'isLoggedIn', 'lastUsed']
        });
        socket.emit('accounts', accounts);
    });
    socket.on('disconnect', () => {
        logger_1.logger.info('Client disconnected');
    });
});
// Forward viewer service events to connected clients
viewerService.on('instanceCreated', (data) => {
    io.emit('viewerCreated', data);
});
viewerService.on('instanceUpdated', (data) => {
    io.emit('viewerUpdated', data);
});
viewerService.on('instanceStopped', (data) => {
    io.emit('viewerStopped', data);
});
viewerService.on('statsUpdated', (stats) => {
    io.emit('stats', {
        ...stats,
        ...proxyService.getProxyStats()
    });
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    try {
        await data_source_1.AppDataSource.initialize();
        logger_1.logger.info('Database initialized');
        await proxyService.loadProxies();
        logger_1.logger.info('Proxies loaded');
        logger_1.logger.info(`Server running on port ${PORT}`);
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
});
//# sourceMappingURL=index.js.map