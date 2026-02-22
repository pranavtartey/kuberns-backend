import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
  } from 'typeorm';
  import { BaseEntity } from '../common/entities/base.entity';
  import { Environment } from './environment.entity';

import { User } from './user.entity';
import { DatabaseConfig } from './database-config.entity';
import { Plan } from 'src/enums/plan.enum';
import { DeploymentStatus } from 'src/enums/deployment-status.enum';

@Entity('webapps')
export class WebApp extends BaseEntity {
  @Column({ type: 'varchar', length: 63 })
  name: string;

  @Column({ type: 'varchar' })
  region: string;               // 'ap-south-1', 'us-east-1', etc.

  @Column({ type: 'varchar' })
  framework: string;            // 'react', 'nextjs', 'express', etc.

  @Column({ type: 'enum', enum: Plan, default: Plan.STARTER })
  plan: Plan;

  // Repo fields
  @Column({ name: 'org_id' })
  orgId: string;

  @Column({ name: 'repo_id' })
  repoId: string;

  @Column()
  branch: string;

  // Deployment status (the simulation engine)
  @Column({ type: 'enum', enum: DeploymentStatus, default: DeploymentStatus.PENDING })
  status: DeploymentStatus;

  @Column({ name: 'status_updated_at', type: 'timestamptz', nullable: true })
  statusUpdatedAt: Date | null;
  
  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'owner_id' })
  ownerId: number;

  @OneToMany(() => Environment, (env) => env.webapp, { cascade: true })
  environments: Environment[];

  @OneToOne(() => DatabaseConfig, (db) => db.webapp, { cascade: true })
  databaseConfig: DatabaseConfig | null;
}