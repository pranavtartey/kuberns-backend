import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, InjectDataSource } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DataSource } from 'typeorm';
import configuration from './config/configuration';
import { WebAppsModule } from './modules/webapps/webapps.module';
import { User } from './entities/user.entity';
import { WebApp } from './entities/webapp.entity';
import { Environment } from './entities/environment.entity';
import { Instance } from './entities/instance.entity';
import { DeploymentLog } from './entities/deployment-log.entity';
import { DatabaseConfig } from './entities/database-config.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        entities: [User, WebApp, Environment, Instance, DeploymentLog, DatabaseConfig],
        synchronize: config.get<boolean>('database.synchronize'),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: { host: config.get('redis.host'), port: config.get<number>('redis.port') },
      }),
    }),
    WebAppsModule,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    const userRepo = this.dataSource.getRepository(User);
    const exists = await userRepo.findOne({ where: { id: 1 } });
    if (!exists) {
      await userRepo.save(
        userRepo.create({ email: 'dummy@kuberns.dev', password: 'not-used', firstName: 'Kuberns', lastName: 'User' }),
      );
    }
  }
}