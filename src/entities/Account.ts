import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ChatMessage } from './ChatMessage';

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned'
}

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column({ type: 'varchar', nullable: true })
  proxyId: string | null = null;

  @Column({ default: false })
  autoFollow: boolean = false;

  @Column({ type: 'datetime', nullable: true })
  lastUsed: Date | null = null;

  @Column({
    type: 'simple-enum',
    enum: AccountStatus,
    default: AccountStatus.INACTIVE
  })
  status: AccountStatus = AccountStatus.INACTIVE;

  @Column({ default: false })
  isLoggedIn: boolean = false;

  @Column({ type: 'simple-json', nullable: true })
  cookies: any[] | null = null;

  @OneToMany(() => ChatMessage, (message: ChatMessage) => message.account)
  messages!: ChatMessage[];
} 