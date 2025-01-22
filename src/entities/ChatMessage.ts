import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Account } from './Account';

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Account, account => account.messages)
  account!: Account;

  @Column()
  channelName!: string;

  @Column()
  message!: string;

  @CreateDateColumn()
  sentAt!: Date;

  @Column({ default: false })
  isAiGenerated: boolean = false;
} 