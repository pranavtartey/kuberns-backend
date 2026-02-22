import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { WebApp } from './webapp.entity';

export enum DbType {
  POSTGRES = 'postgres',
  MYSQL = 'mysql',
}

@Entity('database_configs')
export class DatabaseConfig extends BaseEntity {
  @OneToOne(() => WebApp, (app) => app.databaseConfig)
  @JoinColumn({ name: 'webapp_id' })
  webapp: WebApp;

  @Column({ name: 'db_type', type: 'enum', enum: DbType })
  dbType: DbType;

  @Column()
  host: string;

  @Column({ type: 'int' })
  port: number;

  @Column({ name: 'db_name' })
  name: string;

  @Column()
  username: string;

  @Column({ select: false }) // never returned in queries
  password: string;
}