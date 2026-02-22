import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
    @Column({ type: 'varchar', length: 255, unique: true })
    email: string;

    @Column({ type: 'varchar', select: false })
    password: string;

    @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
    firstName: string | null;

    @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
    lastName: string | null;
}