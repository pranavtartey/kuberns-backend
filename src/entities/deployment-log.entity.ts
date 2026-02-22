import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Instance } from './instance.entity';

@Entity('deployment_logs')
export class DeploymentLog extends BaseEntity {
  @ManyToOne(() => Instance, (instance) => instance.deploymentLogs)
  @JoinColumn({ name: 'instance_id' })
  instance: Instance;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'logged_at' })
  loggedAt: Date;
}