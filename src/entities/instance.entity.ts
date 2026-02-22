import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Environment } from './environment.entity';
import { DeploymentLog } from './deployment-log.entity';
import { InstanceStatus } from 'src/enums/instance-status.enum';


@Entity('instances')
export class Instance extends BaseEntity {
    @ManyToOne(() => Environment, (env) => env.instances)
    @JoinColumn({ name: 'environment_id' })
    environment: Environment;

    @Column({ default: '0.5 vCPU' })
    cpu: string;

    @Column({ default: '512MB' })
    ram: string;

    @Column({ default: '1GB' })
    storage: string;

    @Column({ type: 'enum', enum: InstanceStatus, default: InstanceStatus.PENDING })
    status: InstanceStatus;

    @Column({ name: 'status_updated_at', type: 'timestamptz', nullable: true })
    statusUpdatedAt: Date | null;

    @OneToMany(() => DeploymentLog, (log) => log.instance)
    deploymentLogs: DeploymentLog[];

    @Column({ name: 'aws_task_arn', type: 'varchar', nullable: true })
    awsTaskArn: string | null;

    @Column({ name: 'aws_instance_id', type: 'varchar', nullable: true })
    awsInstanceId: string | null;
}