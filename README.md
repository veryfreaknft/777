# Twitch Viewer Bot

![License](https://img.shields.io/github/license/BitcircuitEU/twitch-viewer-bot)
![Issues](https://img.shields.io/github/issues/BitcircuitEU/twitch-viewer-bot)
![Stars](https://img.shields.io/github/stars/BitcircuitEU/twitch-viewer-bot)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)

A sophisticated Twitch viewer service with web interface for managing multiple viewer instances through proxies.

## ⚠️ Disclaimer

This project is for **educational purposes only**. The use of this software to manipulate viewer counts or automate actions on Twitch may violate Twitch's Terms of Service. Use at your own risk.

## 🚀 Features

- **Dashboard**: Real-time monitoring of viewer instances and system statistics
- **Account Manager**: Manage Twitch accounts with proxy support
- **Chat Manager**: Automated chat messages with customizable templates
- **Proxy Support**: HTTP/HTTPS proxy support with authentication
- **Cookie-based Authentication**: Secure account management without storing passwords
- **Auto-Follow**: Optional automatic channel following
- **Real-time Updates**: Live status updates via WebSocket

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/BitcircuitEU/twitch-viewer-bot.git

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## ⚙️ Configuration

### Proxy List (proxy_list.txt)
Create a file named `proxy_list.txt` in the root directory with your proxies in the following format:
```
ip:port:username:password
ip:port
```
Example:
```
192.168.1.1:8080:user:pass
192.168.1.2:8080
```

## 📋 Usage

### Dashboard
- Overview of all active viewers
- Real-time statistics
- System resource monitoring

### Account Manager
- Add accounts using Cookie-Editor browser extension
- Bind accounts to specific proxies
- Monitor account status and login state

### Chat Manager
- Create message templates
- Set message delays
- Enable/disable chat automation

## 🔧 Technical Details

- Built with TypeScript and Node.js
- Uses SQLite for data storage
- Real-time updates with Socket.IO
- Puppeteer for browser automation
- Express.js web server

## 📦 Requirements

- Node.js 16+
- HTTP/HTTPS Proxies
- Chrome/Chromium browser

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/BitcircuitEU/twitch-viewer-bot/issues).

## 📝 License

This project is [MIT](./LICENSE) licensed. 