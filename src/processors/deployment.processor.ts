import { Processor, Process } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { WebApp } from '../entities/webapp.entity';
import { Instance } from '../entities/instance.entity';
import { AwsProvisionerService } from '../modules/services/aws-provisioner.service';
import { DeploymentLog } from 'src/entities/deployment-log.entity';
import { DeploymentStatus } from 'src/enums/deployment-status.enum';
import { InstanceStatus } from 'src/enums/instance-status.enum';

@Processor('deployment')
export class DeploymentProcessor {
    constructor(
        @InjectRepository(WebApp)
        private readonly webAppRepo: Repository<WebApp>,
        @InjectRepository(Instance)
        private readonly instanceRepo: Repository<Instance>,
        @InjectRepository(DeploymentLog)
        private readonly deploymentLogRepo: Repository<DeploymentLog>,
        private readonly awsProvisioner: AwsProvisionerService,
    ) { }

    @Process('simulate')
    async handleDeployment(job: Job<{ webappId: number }>) {
        const webapp = await this.webAppRepo.findOne({
            where: { id: job.data.webappId },
            relations: ['environments', 'environments.instances'],
        });
        if (!webapp) return;

        const stages: { status: DeploymentStatus; message: string; delay: number }[] = [
            { status: DeploymentStatus.DEPLOYING, message: 'Provisioning ECS cluster...', delay: 3000 },
            { status: DeploymentStatus.DEPLOYING, message: 'Pulling container image from ECR...', delay: 4000 },
            { status: DeploymentStatus.DEPLOYING, message: 'Configuring load balancer...', delay: 3000 },
            { status: DeploymentStatus.DEPLOYING, message: 'Running health checks...', delay: 2000 },
            { status: DeploymentStatus.ACTIVE, message: 'Deployment complete. App is live.', delay: 0 },
        ];

        for (const stage of stages) {
            if (stage.delay > 0) await new Promise((res) => setTimeout(res, stage.delay));

            await this.webAppRepo.update(webapp.id, {
                status: stage.status,
                statusUpdatedAt: new Date(),
            });

            for (const env of webapp.environments) {
                for (const instance of env.instances) {
                    if (stage.status === DeploymentStatus.ACTIVE && !instance.awsInstanceId) {
                        const instanceId = await this.awsProvisioner.provisionEc2Instance(webapp, instance);
                        await this.instanceRepo.update(instance.id, { awsInstanceId: instanceId });
                    }

                    await this.instanceRepo.update(instance.id, {
                        status: stage.status as unknown as InstanceStatus,
                        statusUpdatedAt: new Date(),
                    });

                    await this.deploymentLogRepo.save(
                        this.deploymentLogRepo.create({
                            instance,
                            status: stage.status,
                            message: stage.message,
                        }),
                    );
                }
            }
        }
    }
}