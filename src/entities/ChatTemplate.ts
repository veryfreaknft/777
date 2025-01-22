import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum TemplateType {
  STATIC = 'static',
  AI_GENERATED = 'ai_generated'
}

@Entity()
export class ChatTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  message!: string;

  @Column({
    type: 'simple-enum',
    enum: TemplateType,
    default: TemplateType.STATIC
  })
  type: TemplateType = TemplateType.STATIC;

  @Column()
  minDelay: number = 60;

  @Column()
  maxDelay: number = 300;

  @Column({ default: true })
  enabled: boolean = true;

  @Column({ type: 'simple-json', nullable: true })
  aiConfig: {
    prompt: string;
    temperature: number;
    maxTokens: number;
  } | null = null;
} 