import "reflect-metadata";
import { DataSource } from "typeorm";
import { Account } from "./entities/Account";
import { ChatMessage } from "./entities/ChatMessage";
import { ChatTemplate } from "./entities/ChatTemplate";

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: "database.sqlite",
    synchronize: true,
    logging: false,
    entities: [Account, ChatMessage, ChatTemplate],
    migrations: [],
    subscribers: [],
}); 