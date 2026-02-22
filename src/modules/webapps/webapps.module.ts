import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { WebApp } from '../../entities/webapp.entity';
import { Environment } from '../../entities/environment.entity';
import { Instance } from '../../entities/instance.entity';
import { DeploymentLog } from '../../entities/deployment-log.entity';
import { WebAppsController } from './webapps.controller';
import { WebAppsService } from './webapps.service';
import { DeploymentProcessor } from '../../processors/deployment.processor';
import { AwsProvisionerService } from '../services/aws-provisioner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebApp, Environment, Instance, DeploymentLog]),
    BullModule.registerQueue({ name: 'deployment' }),
  ],
  controllers: [WebAppsController],
  providers: [WebAppsService, DeploymentProcessor, AwsProvisionerService],
})
export class WebAppsModule {}