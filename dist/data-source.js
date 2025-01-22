"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const Account_1 = require("./entities/Account");
const ChatMessage_1 = require("./entities/ChatMessage");
const ChatTemplate_1 = require("./entities/ChatTemplate");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "sqlite",
    database: "database.sqlite",
    synchronize: true,
    logging: false,
    entities: [Account_1.Account, ChatMessage_1.ChatMessage, ChatTemplate_1.ChatTemplate],
    migrations: [],
    subscribers: [],
});
//# sourceMappingURL=data-source.js.map