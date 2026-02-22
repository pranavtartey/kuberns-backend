import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { WebApp } from './webapp.entity';
import { Instance } from './instance.entity';
import { EncryptedEnvVar } from 'src/enums/env';


@Entity('environments')
export class Environment extends BaseEntity {
    @ManyToOne(() => WebApp, (app) => app.environments)
    @JoinColumn({ name: 'webapp_id' })
    webapp: WebApp;

    @Column()
    branch: string;

    @Column({ type: 'int', nullable: true })
    port: number | null;

    @Column({ name: 'assign_random_port', default: true })
    assignRandomPort: boolean;

    @Column({ name: 'env_variables', type: 'jsonb', default: [] })
    envVariables: EncryptedEnvVar[];

    @OneToMany(() => Instance, (inst) => inst.environment, { cascade: true })
    instances: Instance[];
}
