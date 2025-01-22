import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { ProxyService } from './services/ProxyService';
import { ViewerService } from './services/ViewerService';
import { AccountService } from './services/AccountService';
import { logger } from './utils/logger';
import { AppDataSource } from './data-source';
import { Account, AccountStatus } from './entities/Account';
import { ChatTemplate, TemplateType } from './entities/ChatTemplate';
import accountsRouter from './routes/accounts';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Services
const proxyService = new ProxyService();
const accountService = new AccountService();
const viewerService = new ViewerService(proxyService, accountService);
const accountRepository = AppDataSource.getRepository(Account);
const templateRepository = AppDataSource.getRepository(ChatTemplate);

// Express configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.use('/accounts', accountsRouter);

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
      type: type as TemplateType,
      minDelay: parseInt(minDelay),
      maxDelay: parseInt(maxDelay),
      enabled: enabled === 'true',
      aiConfig: type === 'ai_generated' ? aiConfig : null
    });
    await templateRepository.save(template);
    res.redirect('/chat');
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/chat/templates/:id', async (req, res) => {
  try {
    const template = await templateRepository.findOne({ where: { id: parseInt(req.params.id) } });
    if (!template) throw new Error('Template not found');
    res.json(template);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/chat/templates/:id', async (req, res) => {
  try {
    const template = await templateRepository.findOne({ where: { id: parseInt(req.params.id) } });
    if (!template) throw new Error('Template not found');
    
    Object.assign(template, req.body);
    await templateRepository.save(template);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/chat/templates/:id/toggle', async (req, res) => {
  try {
    const template = await templateRepository.findOne({ where: { id: parseInt(req.params.id) } });
    if (!template) throw new Error('Template not found');
    
    template.enabled = !template.enabled;
    await templateRepository.save(template);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/chat/templates/:id', async (req, res) => {
  try {
    const template = await templateRepository.findOne({ where: { id: parseInt(req.params.id) } });
    if (!template) throw new Error('Template not found');
    
    await templateRepository.remove(template);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// WebSocket events
io.on('connection', (socket) => {
  logger.info('Client connected');

  // Send initial stats
  socket.emit('stats', {
    ...viewerService.getStats(),
    ...proxyService.getProxyStats()
  });

  // Handle viewer creation
  socket.on('createViewer', async (data: { targetUrl: string; accountId?: number }) => {
    const instance = await viewerService.createInstance(data.targetUrl, data.accountId);
    if (!instance) {
      socket.emit('error', { message: 'Failed to create viewer' });
    }
  });

  // Handle viewer stop request
  socket.on('stopViewer', async (data: { id: number }) => {
    await viewerService.stopInstance(data.id);
  });

  // Handle screenshot request
  socket.on('requestScreenshot', async (data: { id: number }) => {
    const screenshot = await viewerService.requestScreenshot(data.id);
    if (screenshot) {
      socket.emit('screenshot', { 
        id: data.id, 
        image: screenshot.toString('base64') 
      });
    }
  });

  // Handle chat message
  socket.on('sendChatMessage', async (data: { id: number; message: string }) => {
    const success = await viewerService.sendChatMessage(data.id, data.message);
    socket.emit('chatMessageResult', {
      id: data.id,
      success,
      message: success ? 'Message sent' : 'Failed to send message'
    });
  });

  // Handle follow request
  socket.on('followChannel', async (data: { id: number }) => {
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
    logger.info('Client disconnected');
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
    await AppDataSource.initialize();
    logger.info('Database initialized');
    
    await proxyService.loadProxies();
    logger.info('Proxies loaded');
    
    logger.info(`Server running on port ${PORT}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}); 