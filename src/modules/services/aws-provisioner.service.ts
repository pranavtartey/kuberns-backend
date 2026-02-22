import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { EC2Client } from '@aws-sdk/client-ec2';
import { RDSClient, CreateDBInstanceCommand } from '@aws-sdk/client-rds';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { WebApp } from '../../entities/webapp.entity';
import { Instance } from '../../entities/instance.entity';
import { DatabaseConfig } from 'src/entities/database-config.entity';
import { RunInstancesCommand } from '@aws-sdk/client-ec2';

@Injectable()
export class AwsProvisionerService {
    private readonly ecsClient: ECSClient;
    private readonly ec2Client: EC2Client;
    private readonly rdsClient: RDSClient;
    private readonly mockMode: boolean;

    constructor(private configService: ConfigService) {
        const awsConfig = {
            region: configService.get('aws.region'),
            credentials: {
                accessKeyId: configService.get('aws.accessKeyId'),
                secretAccessKey: configService.get('aws.secretAccessKey'),
            },
        };
        this.ecsClient = new ECSClient(awsConfig);
        this.ec2Client = new EC2Client(awsConfig);
        this.rdsClient = new RDSClient(awsConfig);
        this.mockMode = configService.get('aws.mockMode') !== 'false';
    }

    async provisionEcsTask(webapp: WebApp, instance: Instance): Promise<string> {
        if (this.mockMode) {
            // Return a realistic-looking mock ARN
            return `arn:aws:ecs:${webapp.region}:123456789012:task/kuberns-cluster/${randomUUID()}`;
        }

        const command = new RunTaskCommand({
            cluster: 'kuberns-cluster',
            taskDefinition: `kuberns-${webapp.framework}:latest`,
            launchType: 'FARGATE',
            overrides: {
                containerOverrides: [{
                    name: 'app',
                    environment: [
                        { name: 'APP_NAME', value: webapp.name },
                        { name: 'BRANCH', value: webapp.branch },
                    ],
                }],
            },
            networkConfiguration: { /* VPC config */ },
        });

        const response = await this.ecsClient.send(command);
        return response.tasks?.[0]?.taskArn ?? '';
    }

    async provisionRdsInstance(dbConfig: DatabaseConfig): Promise<string> {
        if (this.mockMode) {
            return `kuberns-db-${randomUUID().slice(0, 8)}.mock.rds.amazonaws.com`;
        }

        const command = new CreateDBInstanceCommand({
            DBInstanceIdentifier: `kuberns-${dbConfig.id}`,
            DBInstanceClass: 'db.t3.micro',
            Engine: dbConfig.dbType,
            MasterUsername: dbConfig.username,
            MasterUserPassword: dbConfig.password,
            AllocatedStorage: 20,
        });

        const response = await this.rdsClient.send(command);
        return response.DBInstance?.Endpoint?.Address ?? '';
    }

    async provisionEc2Instance(webapp: WebApp, instance: Instance): Promise<string> {
        const subnetId = this.configService.get<string>('aws.subnetId');
        const securityGroupId = this.configService.get<string>('aws.securityGroupId');

        if (this.mockMode) {
            return `i-mock${randomUUID().slice(0, 8)}`;
        }

        if (!subnetId || !securityGroupId) {
            throw new Error('AWS_SUBNET_ID and AWS_SECURITY_GROUP_ID must be set when AWS_MOCK_MODE is false');
        }

        const amiId = this.configService.get<string>('aws.amiId') ?? this.getDefaultAmi(webapp.region);
        const command = new RunInstancesCommand({
            // ImageId: amiId,
            ImageId: 'ami-002e81a9a522f1f19',
            InstanceType: 't3.micro',
            MinCount: 1,
            MaxCount: 1,
            SubnetId: subnetId,
            SecurityGroupIds: [securityGroupId],
            TagSpecifications: [{
                ResourceType: 'instance',
                Tags: [
                    { Key: 'Name', Value: `kuberns-${webapp.name}-${instance.id}` },
                    { Key: 'kuberns-webapp-id', Value: String(webapp.id) },
                ],
            }],
        });

        try {
            const response = await this.ec2Client.send(command);
            const instanceId = response.Instances?.[0]?.InstanceId;
            if (!instanceId) throw new Error('EC2 RunInstances returned no instance ID');
            return instanceId;
        } catch (error) {
            console.error('EC2 ERROR:', error);
            throw error;
        }
    }

    private getDefaultAmi(region: string): string {
        const defaults: Record<string, string> = {
            'ap-south-1': 'ami-0f5ee99e8f549f4f6',
            'us-east-1': 'ami-002e81a9a522f1f19',
            'us-west-2': 'ami-0d705db840ec5f0c5',
            'eu-west-1': 'ami-0d71ea30463e0ff8d',
        };
        return defaults[region] ?? defaults['us-east-1'];
    }

}