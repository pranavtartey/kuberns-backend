import {
    IsString,
    IsNotEmpty,
    IsBoolean,
    IsOptional,
    IsInt,
    Min,
    Max,
    IsArray,
    ValidateNested,
    IsEnum,
    MinLength,
    MaxLength,
    Matches,
  } from 'class-validator';
  import { Type } from 'class-transformer';
import { Region } from 'src/enums/region.enum';
import { Framework } from 'src/enums/framework.enum';
import { Plan } from 'src/enums/plan.enum';


export class CreateEnvVariableDto {
    @IsString() @IsNotEmpty()
    key: string;
  
    @IsString()
    value: string;
  }
  
  export class CreateInstanceDto {
    @IsOptional() @IsString()
    cpu?: string;
  
    @IsOptional() @IsString()
    ram?: string;
  }
  
  export class CreateEnvironmentDto {
    @IsString() @IsNotEmpty()
    branch: string;
  
    @IsBoolean()
    assignRandomPort: boolean;
  
    @IsOptional() @IsInt() @Min(1024) @Max(65535)
    port?: number;
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEnvVariableDto)
    envVariables: CreateEnvVariableDto[];
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateInstanceDto)
    instances: CreateInstanceDto[];
  }
  
  export class CreateWebAppDto {
    @IsString() @MinLength(1) @MaxLength(63)
    @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
    name: string;
  
    @IsEnum(Region)
    region: Region;
  
    @IsEnum(Framework)
    framework: Framework;
  
    @IsEnum(Plan)
    plan: Plan;
  
    @IsString() @IsNotEmpty()
    orgId: string;
  
    @IsString() @IsNotEmpty()
    repoId: string;
  
    @IsString() @IsNotEmpty()
    branch: string;
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEnvironmentDto)
    environments: CreateEnvironmentDto[];
  }
