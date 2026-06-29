import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CategoryIcon {
  HEART = 'heart',
  FIRE = 'fire',
  STAR = 'star',
  LIGHTNING = 'lightning',
  BOOKMARK = 'bookmark',
  SMILE = 'smile',
  ANGER = 'anger',
  DROP = 'drop',
  MUSIC = 'music',
  GAME = 'game',
  WORK = 'work',
  SCHOOL = 'school',
  TRAVEL = 'travel',
  FOOD = 'food',
  FITNESS = 'fitness',
  TECH = 'tech',
  OTHER = 'other',
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  @Index()
  name: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  @Index()
  slug: string;

  @Column({
    type: 'enum',
    enum: CategoryIcon,
    default: CategoryIcon.OTHER,
  })
  icon: CategoryIcon;

  @Column({ type: 'varchar', length: 7, default: '#6366f1' })
  color: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  confessionCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
