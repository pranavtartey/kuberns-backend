import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { WebApp } from '../../entities/webapp.entity';
import { Environment } from '../../entities/environment.entity';
import { Instance } from '../../entities/instance.entity';
import { DeploymentLog } from '../../entities/deployment-log.entity';
import { CreateWebAppDto } from '../../dtos/create-webapp.dto';
import { encrypt } from '../../common/utils/crypto.util';
import type { Queue } from 'bull';

@Injectable()
export class WebAppsService {
    constructor(
        @InjectRepository(WebApp)
        private readonly webAppRepo: Repository<WebApp>,
        @InjectRepository(Environment)
        private readonly envRepo: Repository<Environment>,
        @InjectRepository(Instance)
        private readonly instanceRepo: Repository<Instance>,
        @InjectRepository(DeploymentLog)
        private readonly logRepo: Repository<DeploymentLog>,
        private readonly dataSource: DataSource,
        @InjectQueue('deployment')
        private readonly deploymentQueue: Queue,
    ) { }

    async create(dto: CreateWebAppDto, userId: number): Promise<WebApp> {
        return this.dataSource.transaction(async (manager) => {
            const webapp = manager.create(WebApp, {
                name: dto.name,
                region: dto.region,
                framework: dto.framework,
                plan: dto.plan,
                orgId: dto.orgId,
                repoId: dto.repoId,
                branch: dto.branch,
                ownerId: userId,
            });
            const savedApp = await manager.save(webapp);

            for (const envDto of dto.environments) {
                const encryptedVars = (envDto.envVariables ?? []).map((v) => ({
                    key: v.key,
                    value: encrypt(v.value),
                }));

                const env = manager.create(Environment, {
                    webapp: savedApp,
                    branch: envDto.branch,
                    port: envDto.assignRandomPort ? null : (envDto.port ?? null),
                    assignRandomPort: envDto.assignRandomPort,
                    envVariables: encryptedVars,
                });
                const savedEnv = await manager.save(env);

                for (const instDto of envDto.instances ?? [{}]) {
                    const instance = manager.create(Instance, {
                        environment: savedEnv,
                        cpu: instDto.cpu ?? '0.5 vCPU',
                        ram: instDto.ram ?? '512MB',
                    });
                    await manager.save(instance);
                }
            }

            await this.deploymentQueue.add('simulate', { webappId: savedApp.id });

            return savedApp;
        });
    }

    async findAll(userId: number): Promise<WebApp[]> {
        return this.webAppRepo.find({
            where: { ownerId: userId },
            relations: ['environments', 'environments.instances'],
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: number, userId: number): Promise<WebApp> {
        const webapp = await this.webAppRepo.findOne({
            where: { id },
            relations: ['environments', 'environments.instances', 'databaseConfig'],
        });
        if (!webapp) throw new NotFoundException(`WebApp ${id} not found`);
        return webapp;
    }

    async getDeploymentStatus(id: number, userId: number) {
        const webapp = await this.findOne(id, userId);
        const logs = await this.logRepo.find({
            where: { instance: { environment: { webapp: { id } } } },
            order: { loggedAt: 'DESC' },
            take: 20,
        });
        return { status: webapp.status, statusUpdatedAt: webapp.statusUpdatedAt, logs };
    }
}
